const FULL_SCREEN_HEADER_GAP = 8;

export const COMPOSER_CORNER_BUTTON_INSET = 44;

export function composerFullScreenMaxHeight(input: {
  readonly screenHeight: number;
  readonly navigationHeaderHeight: number;
  readonly keyboardHeight: number;
  readonly composerBottomInset: number;
}): number {
  // The sticky view lowers the composer by its bottom inset once the keyboard is open.
  const keyboardIntrusion =
    input.keyboardHeight > 0 ? Math.max(0, input.keyboardHeight - input.composerBottomInset) : 0;
  return Math.max(
    0,
    input.screenHeight -
      Math.max(0, input.navigationHeaderHeight) -
      keyboardIntrusion -
      FULL_SCREEN_HEADER_GAP,
  );
}

export function composerFullScreenEditorHeight(input: {
  readonly maxHeight: number;
  readonly chromeHeight: number;
  readonly minimumHeight: number;
}): number {
  return Math.max(input.minimumHeight, Math.floor(input.maxHeight - input.chromeHeight));
}
