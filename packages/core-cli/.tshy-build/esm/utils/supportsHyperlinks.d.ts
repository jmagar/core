/**
    Creates a supports hyperlinks check for a given stream.

    @param stream - Optional stream to check for hyperlink support.
    @returns boolean indicating whether hyperlinks are supported.
*/
export declare function createSupportsHyperlinks(stream: NodeJS.WriteStream): boolean;
/** Object containing hyperlink support status for stdout and stderr. */
declare const supportsHyperlinks: {
    /** Whether stdout supports hyperlinks. */
    stdout: boolean;
    /** Whether stderr supports hyperlinks. */
    stderr: boolean;
};
export default supportsHyperlinks;
