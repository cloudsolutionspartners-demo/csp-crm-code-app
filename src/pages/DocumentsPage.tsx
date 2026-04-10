import * as React from 'react';
import { PageHeader, EmptyState } from '../components/Shared';
import { FileStack } from '../components/Icons';

export default function DocumentsPage() {
  return (
    <div>
      <PageHeader title="Company Documents" subtitle="Manage company documents and files" action={<button className="csp-btn csp-btn-primary">Upload Document</button>} />
      <EmptyState icon={<FileStack className="csp-icon-xl" />} title="No documents yet" description="Upload company documents, certificates, and other files. Documents will be organized by entity and type." />
    </div>
  );
}
