/**
 * stripHtml (src/utils/stripHtml.ts)
 *
 * Converts HTML content to plain text.
 * Job descriptions from APIs and scrapers often contain HTML tags like
 * <p>, <li>, <strong>, <br> etc. We strip them before storing so the
 * database has clean, readable text.
 *
 * WHY PRESERVE <br> AND <p> ENDINGS?
 * So bullet points and paragraphs still have line breaks after stripping.
 * Without this, the entire description becomes one long unreadable line.
 * Example:
 *   <p>We are hiring.</p><p>You will build APIs.</p>
 *   → "We are hiring.\nYou will build APIs."   ← readable
 *   → "We are hiring.You will build APIs."      ← without preservation ← bad
 *
 * WHY HANDLE HTML ENTITIES (&amp; &nbsp; etc.)?
 * HTML entities are escape sequences for special characters:
 *   &amp;  = &
 *   &nbsp; = non-breaking space (appears as space)
 *   &lt;   = <
 *   &gt;   = >
 * If we don't replace them, the stored text will literally say "&amp;" instead of "&".
 */
export const stripHtml = (html: string): string =>
  html
    // Convert <br> tags to newlines BEFORE stripping — preserves paragraph breaks
    .replace(/<br\s*\/?>/gi, '\n')
    // Convert closing </p> tags to newlines — each paragraph on its own line
    .replace(/<\/p>/gi, '\n')
    // Convert closing </li> tags to newlines — each list item on its own line
    .replace(/<\/li>/gi, '\n')
    // Convert opening <li> tags to bullet points — readable list formatting
    .replace(/<li[^>]*>/gi, '• ')
    // Strip ALL remaining HTML tags (the catch-all)
    // [^>]+ matches any characters that aren't ">" — i.e. the tag contents
    .replace(/<[^>]+>/g, '')
    // Replace HTML entities with their actual characters
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Collapse 3+ consecutive whitespace/newlines to 2 (one blank line max)
    // This prevents massive gaps that sometimes appear after stripping tag-heavy HTML
    .replace(/\s{3,}/g, '\n\n')
    // Remove leading/trailing whitespace from the final string
    .trim()
