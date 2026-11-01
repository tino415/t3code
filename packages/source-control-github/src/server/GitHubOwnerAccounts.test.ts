import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { afterEach, beforeEach, describe, expect, it, vi } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import { ChildProcessSpawner } from "effect/process";
import { HttpClient, HttpClientResponse, type HttpClientRequest } from "effect/http";

import { DEFAULT_SERVER_SETTINGS } from "@t3tools/contracts";
import type * as SourceControlHost from "@t3tools/source-control-core/server/SourceControlHost";
import * as SourceControlRateLimit from "@t3tools/source-control-core/server/SourceControlRateLimit";
import { applyServerSettingsPatch } from "@t3tools/shared/serverSettings";
import * as TestSourceControlHost from "@t3tools/source-control-testing/TestSourceControlHost";

import * as GitHubAppAccess from "./GitHubAppAccess.ts";
import * as GitHubAppSignIn from "./GitHubAppSignIn.ts";
import * as GitHubCredentials from "./GitHubCredentials.ts";
import * as GitHubRequestPolicy from "./GitHubRequestPolicy.ts";
import * as GitHubRest from "./GitHubRest.ts";
import * as GitHubPullRequestApi from "./GitHubPullRequestApi.ts";
import * as GitHubPullRequestProvider from "./GitHubPullRequestProvider.ts";
import * as GitHubQuota from "./GitHubQuota.ts";

const OWNER_ACCOUNTS = "payout-one=martin,*=tino";

beforeEach(() => {
  for (const name of ["GH_TOKEN", "GITHUB_TOKEN"]) vi.stubEnv(name, "");
  vi.stubEnv("T3CODE_GITHUB_OWNER_ACCOUNTS", OWNER_ACCOUNTS);
});
afterEach(() => {
  vi.unstubAllEnvs();
});

function credentialsFromGh(pinnedAccount?: string) {
  const calls: Array<ReadonlyArray<string>> = [];
  const run: SourceControlHost.SourceControlHost["Service"]["process"]["run"] = (input) =>
    Effect.sync(() => {
      calls.push(input.args);
      const user = input.args.includes("--user")
        ? input.args[input.args.indexOf("--user") + 1]
        : undefined;
      return {
        exitCode: ChildProcessSpawner.ExitCode(0),
        stdout: user === undefined ? "active-token\n" : `token-for-${user}\n`,
        stderr: "",
        stdoutTruncated: false,
        stderrTruncated: false,
      };
    });
  const hosts =
    pinnedAccount === undefined ? {} : { "github.com": { enabled: true, account: pinnedAccount } };
  const layer = GitHubCredentials.layer.pipe(
    Layer.provideMerge(
      TestSourceControlHost.layer({
        settings: applyServerSettingsPatch(DEFAULT_SERVER_SETTINGS, {
          sourceControlHosts: { github: { hosts, tokens: {} } },
        }),
        process: { run },
      }),
    ),
    Layer.provide(NodeCrypto.layer),
  );
  return { layer, calls };
}

const tokenOf = (host: string, owner?: string) =>
  GitHubCredentials.GitHubCredentials.pipe(
    Effect.flatMap((credentials) => credentials.get(host, owner)),
    Effect.map((credential) => Redacted.value(credential.token)),
  );

describe("the account of a repository owner", () => {
  it.effect("is the one named for that owner, in any case", () =>
    Effect.gen(function* () {
      expect(yield* tokenOf("github.com", "payout-one")).toBe("token-for-martin");
      expect(yield* tokenOf("github.com", "Payout-One")).toBe("token-for-martin");
    }).pipe(Effect.provide(credentialsFromGh().layer)),
  );

  it.effect("is the `*` account for any other owner, and for no owner", () =>
    Effect.gen(function* () {
      expect(yield* tokenOf("github.com", "someone-else")).toBe("token-for-tino");
      expect(yield* tokenOf("github.com")).toBe("token-for-tino");
    }).pipe(Effect.provide(credentialsFromGh().layer)),
  );

  it.effect("outranks a pin in Settings, which outranks `*`", () =>
    Effect.gen(function* () {
      expect(yield* tokenOf("github.com", "payout-one")).toBe("token-for-martin");
      expect(yield* tokenOf("github.com", "someone-else")).toBe("token-for-pinned");
    }).pipe(Effect.provide(credentialsFromGh("pinned").layer)),
  );

  it.effect("applies only to github.com", () =>
    Effect.gen(function* () {
      expect(yield* tokenOf("git.acme.internal", "payout-one")).toBe("active-token");
    }).pipe(Effect.provide(credentialsFromGh().layer)),
  );

  it.effect("yields to an environment token, as gh does", () => {
    vi.stubEnv("GH_TOKEN", "env-token");
    return Effect.gen(function* () {
      expect(yield* tokenOf("github.com", "payout-one")).toBe("env-token");
    }).pipe(Effect.provide(credentialsFromGh().layer));
  });

  it.effect("is asked again after that owner's token was dropped, and only that owner's", () => {
    const { layer, calls } = credentialsFromGh();
    return Effect.gen(function* () {
      const credentials = yield* GitHubCredentials.GitHubCredentials;
      yield* tokenOf("github.com", "payout-one");
      yield* tokenOf("github.com");
      yield* credentials.invalidate("github.com", "payout-one");
      yield* tokenOf("github.com", "payout-one");
      yield* tokenOf("github.com");
      expect(calls.map((args) => args.at(-1))).toEqual(["martin", "tino", "martin"]);
    }).pipe(Effect.provide(layer));
  });
});

describe("ownerAccounts", () => {
  it("skips malformed entries and tolerates spaces", () => {
    expect([
      ...GitHubCredentials.ownerAccounts({
        T3CODE_GITHUB_OWNER_ACCOUNTS: " Acme = one ,broken,=two,three=,*=four",
      }),
    ]).toEqual([
      ["acme", "one"],
      ["*", "four"],
    ]);
    expect(GitHubCredentials.ownerAccounts({}).size).toBe(0);
  });
});

function apiWithOwnerTokens(body: unknown = { data: {} }) {
  const requests: Array<HttpClientRequest.HttpClientRequest> = [];
  const credentials = Layer.succeed(
    GitHubCredentials.GitHubCredentials,
    GitHubCredentials.GitHubCredentials.of({
      get: (host, owner) =>
        Effect.succeed({
          host,
          token: Redacted.make(`token-of-${owner ?? "nobody"}`),
          source: "gh" as const,
          fingerprint: `${host}:${owner ?? "nobody"}`,
        }),
      saved: () => Effect.succeedNone,
      fingerprint: (host, token) => Effect.succeed(`${host}:${token}`),
      invalidate: () => Effect.void,
    }),
  );
  const http = Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((request) => {
      requests.push(request);
      return Effect.succeed(
        HttpClientResponse.fromWeb(request, new Response(JSON.stringify(body))),
      );
    }),
  );
  const layer = GitHubPullRequestApi.layer.pipe(
    Layer.provideMerge(GitHubAppAccess.layer),
    Layer.provideMerge(GitHubRest.layer),
    Layer.provideMerge(
      Layer.mock(GitHubAppSignIn.GitHubAppSignIn)({
        enabled: false,
        token: () => Effect.succeedNone,
        invalidate: () => Effect.void,
      }),
    ),
    Layer.provideMerge(GitHubQuota.layer),
    Layer.provideMerge(SourceControlRateLimit.layer),
    Layer.provideMerge(http),
    Layer.provideMerge(credentials),
    Layer.provide(NodeCrypto.layer),
    Layer.provide(TestSourceControlHost.layer()),
    Layer.provide(NodeServices.layer),
  );
  const tokens = () => requests.map((request) => request.headers.authorization);
  return { layer, requests, tokens };
}

const PINNED = {
  host: "github.com",
  token: Redacted.make("pinned-token"),
  credentialFingerprint: "github.com:pinned",
};

describe("a GitHub request", () => {
  it.effect("carries the token of the owner its REST path names", () => {
    const { layer, tokens } = apiWithOwnerTokens();
    return Effect.gen(function* () {
      const rest = yield* GitHubRest.GitHubRest;
      yield* rest.rest({ host: "github.com", operation: "a", path: "repos/payout-one/main/pulls" });
      yield* rest.rest({ host: "github.com", operation: "b", path: "/repos/a%2Db/main" });
      yield* rest.rest({ host: "github.com", operation: "c", path: "user" });
      expect(tokens()).toEqual([
        "Bearer token-of-payout-one",
        "Bearer token-of-a-b",
        "Bearer token-of-nobody",
      ]);
    }).pipe(Effect.provide(layer));
  });


  it.effect("follows the operation's owner over what the request names", () => {
    const { layer, tokens } = apiWithOwnerTokens();
    return Effect.gen(function* () {
      const rest = yield* GitHubRest.GitHubRest;
      yield* rest
        .rest({ host: "github.com", operation: "a", path: "repos/a-fork/main" })
        .pipe(Effect.provideService(GitHubRequestPolicy.CredentialOwner, "payout-one"));
      expect(tokens()).toEqual(["Bearer token-of-payout-one"]);
    }).pipe(Effect.provide(layer));
  });

  it.effect("leaves a pinned credential only for an owner named with its own account", () => {
    const { layer, tokens } = apiWithOwnerTokens();
    return Effect.gen(function* () {
      const rest = yield* GitHubRest.GitHubRest;
      const pinned = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
        effect.pipe(Effect.provideService(GitHubRequestPolicy.PinnedGitHubCredential, PINNED));
      yield* pinned(rest.rest({ host: "github.com", operation: "a", path: "repos/payout-one/x" }));
      yield* pinned(rest.rest({ host: "github.com", operation: "b", path: "repos/someone/x" }));
      yield* pinned(rest.rest({ host: "github.com", operation: "c", path: "user" }));
      expect(tokens()).toEqual([
        "Bearer token-of-payout-one",
        "Bearer pinned-token",
        "Bearer pinned-token",
      ]);
    }).pipe(Effect.provide(layer));
  });
});

describe("GitHubPullRequestApi", () => {
  const INPUT = { cwd: "/repo", host: "github.com", number: 1 };

  it.effect("sends the requests of an operation under the owner of its repository", () => {
    const { layer, tokens } = apiWithOwnerTokens({
      data: { repository: { pullRequest: { id: "PR_1" } }, addComment: {} },
    });
    return Effect.gen(function* () {
      const cli = yield* GitHubPullRequestApi.GitHubPullRequestApi;
      yield* Effect.exit(
        cli.commentOnPullRequest({ ...INPUT, repository: "payout-one/main", body: "hello" }),
      );
      expect(tokens().length).toBeGreaterThan(0);
      expect(new Set(tokens())).toEqual(new Set(["Bearer token-of-payout-one"]));
    }).pipe(Effect.provide(layer));
  });

  it.live("keeps summaries read in one window apart by owner", () => {
    const { layer, requests } = apiWithOwnerTokens();
    return Effect.gen(function* () {
      const cli = yield* GitHubPullRequestApi.GitHubPullRequestApi;
      yield* Effect.forEach(
        ["payout-one/main", "tino415/system", "payout-one/other"],
        (repository) => Effect.exit(cli.getPullRequestSummary({ ...INPUT, repository })),
        { concurrency: "unbounded" },
      );
      // An unreadable batch falls back to one read each, so only the pairing is fixed.
      const sent = requests.map((request) => ({
        token: request.headers.authorization,
        body: request.body._tag === "Uint8Array" ? new TextDecoder().decode(request.body.body) : "",
      }));
      const naming = (owner: string) => sent.filter(({ body }) => body.includes(owner));
      expect(naming("payout-one").length).toBeGreaterThan(0);
      expect(naming("tino415").length).toBeGreaterThan(0);
      expect(new Set(naming("payout-one").map(({ token }) => token))).toEqual(
        new Set(["Bearer token-of-payout-one"]),
      );
      expect(new Set(naming("tino415").map(({ token }) => token))).toEqual(
        new Set(["Bearer token-of-tino415"]),
      );
    }).pipe(Effect.provide(layer));
  });

  it.live("keeps watch fingerprints read in one window apart by owner", () => {
    const { layer, tokens } = apiWithOwnerTokens();
    return Effect.gen(function* () {
      const cli = yield* GitHubPullRequestApi.GitHubPullRequestApi;
      yield* Effect.forEach(
        ["payout-one/main", "tino415/system"],
        (repository) => Effect.exit(cli.getPullRequestWatchFingerprint({ ...INPUT, repository })),
        { concurrency: "unbounded" },
      );
      expect([...tokens()].sort()).toEqual([
        "Bearer token-of-payout-one",
        "Bearer token-of-tino415",
      ]);
    }).pipe(Effect.provide(layer));
  });
});

describe("GitHubPullRequestProvider", () => {
  const provider = GitHubPullRequestProvider.make.pipe(
    Effect.provideService(GitHubPullRequestApi.GitHubPullRequestApi, {} as never),
  );

  it.effect("asks per repository once owners have accounts of their own", () =>
    Effect.gen(function* () {
      const api = yield* provider;
      expect(api.listChangeRequestsAcross).toBeUndefined();
      expect(api.listChangeRequestStats).toBeUndefined();
    }),
  );

  it.effect("keeps its reads across repositories otherwise", () => {
    vi.stubEnv("T3CODE_GITHUB_OWNER_ACCOUNTS", "");
    return Effect.gen(function* () {
      const api = yield* provider;
      expect(api.listChangeRequestsAcross).toBeDefined();
      expect(api.listChangeRequestStats).toBeDefined();
    });
  });
});
