import { ReactNode } from "react";

export function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="section-card">
      <div className="section-card-header">
        <h2>{title}</h2>
      </div>
      <div>{children}</div>
    </section>
  );
}
