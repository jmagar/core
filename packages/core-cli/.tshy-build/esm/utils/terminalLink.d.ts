export type TerminalLinkOptions = {
    /**
      Override the default fallback. If false, the fallback will be disabled.
      @default `${text} (${url})`
    */
    readonly fallback?: ((text: string, url: string) => string) | boolean;
};
/**
    Create a clickable link in the terminal's stdout.

    [Supported terminals.](https://gist.github.com/egmontkob/eb114294efbcd5adb1944c9f3cb5feda)
    For unsupported terminals, the link will be printed in parens after the text: `My website (https://sindresorhus.com)`,
    unless the fallback is disabled by setting the `fallback` option to `false`.

    @param text - Text to linkify.
    @param url - URL to link to.

    @example
    ```
    import terminalLink from 'terminal-link';

    const link = terminalLink('My Website', 'https://sindresorhus.com');
    console.log(link);
    ```

    @deprecated The default fallback is broken in some terminals. Please use `cliLink` instead.
*/
declare function terminalLink(text: string, url: string, { target, ...options }?: {
    target?: "stdout" | "stderr";
} & TerminalLinkOptions): string;
declare namespace terminalLink {
    var isSupported: boolean;
    var stderr: typeof terminalLinkStderr;
}
/**
    Create a clickable link in the terminal's stderr.

    [Supported terminals.](https://gist.github.com/egmontkob/eb114294efbcd5adb1944c9f3cb5feda)
    For unsupported terminals, the link will be printed in parens after the text: `My website (https://sindresorhus.com)`.

    @param text - Text to linkify.
    @param url - URL to link to.

    @example
    ```
    import terminalLink from 'terminal-link';

    const link = terminalLink.stderr('My Website', 'https://sindresorhus.com');
    console.error(link);
    ```
*/
declare function terminalLinkStderr(text: string, url: string, options?: TerminalLinkOptions): string;
declare namespace terminalLinkStderr {
    var isSupported: boolean;
}
export { terminalLink };
