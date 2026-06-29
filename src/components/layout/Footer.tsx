import Link from "next/link";
import { content } from "@theme/content";

export function Footer() {
  return (
    <footer className="border-t border-border mt-16">
      <div className="container mx-auto px-4 py-8 max-w-[1200px] flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-sm text-muted-foreground">
        <div>{content.copyright}</div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2">
          <a href="/about" className="hover:text-foreground">{content.footer.about}</a>
          <a href="/rules" className="hover:text-foreground">{content.footer.rules}</a>
          <a href="/contacts" className="hover:text-foreground">{content.footer.contacts}</a>
          <Link href="/privacy" className="hover:text-foreground">
            {content.footer.privacyLink}
          </Link>
        </nav>
      </div>
      <div className="container mx-auto px-4 pb-6 max-w-[1200px] text-xs text-muted-foreground">
        {content.footer.disclaimer}
      </div>
    </footer>
  );
}
