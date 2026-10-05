// Which email addresses may appear in what we ship to every browser. A person's own address (an advisor's, a developer's) must never be compiled
// in: a real support contact comes from the server's configuration, so it can be changed without a release and never sits in a bundle.
//
// Allowed: our own company domain, and the obviously-fake domains used in placeholders ("you@example.com").
export const ALLOWED_EMAIL_DOMAINS = ["finuxia.com", "example.com", "example.org", "example.net", "email.com", "domain.ca"];

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;

/** Every address in `text` whose domain is not on the allowlist (each once, lower-cased). */
export function personalEmails(text) {
  const found = new Set();
  for (const match of text.matchAll(EMAIL)) {
    const address = match[0].toLowerCase();
    const domain = address.slice(address.lastIndexOf("@") + 1);
    if (!ALLOWED_EMAIL_DOMAINS.some((allowed) => domain === allowed || domain.endsWith(`.${allowed}`))) found.add(address);
  }
  return [...found].sort();
}
