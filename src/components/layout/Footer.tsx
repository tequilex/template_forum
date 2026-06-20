import { content } from "@theme/content";

export function Footer() {
  return (
    <footer className="border-t border-border mt-16">
      <div className="container mx-auto px-4 py-8 max-w-[1200px] flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-sm text-muted-foreground">
        <div>{content.copyright}</div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2">
          {/* TODO(plan-5): вернуть <Link> когда появятся /about, /rules, /contacts */}
          <a href="/about" className="hover:text-foreground">{content.footer.about}</a>
          <a href="/rules" className="hover:text-foreground">{content.footer.rules}</a>
          <a href="/contacts" className="hover:text-foreground">{content.footer.contacts}</a>
        </nav>
      </div>
    </footer>
  );
}
