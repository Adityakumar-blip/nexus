"use client";

import { PageHeader } from "@/components/page-header";
import { DocsWorkspace } from "@/components/docs-workspace";

export default function DocsPage() {
  return (
    <>
      <PageHeader
        title="Docs"
        description="Notion-style nested pages — write, organize, and link your knowledge."
      />
      <div className="h-[calc(100svh-89px)]">
        <DocsWorkspace />
      </div>
    </>
  );
}
