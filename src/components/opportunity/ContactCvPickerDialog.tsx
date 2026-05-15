import { useEffect, useState } from 'react';
import { Dialog } from '../Layout';
import { FileText } from '../Icons';
import type { ContactCv } from '../../types/crm';

export interface ContactCvPickerDialogProps {
  open: boolean;
  contactCvs: (ContactCv & { contactId?: string })[];
  contactName: string;
  onCancel: () => void;
  onPick: (cv: ContactCv & { contactId?: string }) => void;
}

export function ContactCvPickerDialog({
  open, contactCvs, contactName, onCancel, onPick,
}: ContactCvPickerDialogProps) {
  // Default selection: the primary one, else first.
  const defaultId = contactCvs.find(c => c.isPrimary)?.id || contactCvs[0]?.id || '';
  const [selectedId, setSelectedId] = useState(defaultId);
  useEffect(() => { if (open) setSelectedId(defaultId); }, [open, defaultId]);

  const selected = contactCvs.find(c => c.id === selectedId);

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={`Select CV for ${contactName}`}
      maxWidth="520px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p style={{ margin: 0, fontSize: 13, color: 'hsl(var(--muted-foreground))' }}>
          This contact has multiple CVs on file. Pick the one to attach to this opportunity.
          A snapshot is copied onto the applicant record — replacing it later won't affect the contact's library.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
          {contactCvs.length === 0 && (
            <p style={{ color: 'hsl(var(--muted-foreground))', fontSize: 13, textAlign: 'center', padding: 16 }}>
              No CVs found on this contact.
            </p>
          )}
          {contactCvs.map(cv => {
            const active = cv.id === selectedId;
            return (
              <button
                key={cv.id}
                type="button"
                onClick={() => setSelectedId(cv.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: 12,
                  border: active ? '2px solid hsl(var(--primary))' : '1px solid hsl(var(--border))',
                  borderRadius: 8, cursor: 'pointer',
                  background: active ? 'hsl(var(--primary) / 0.05)' : 'white',
                  textAlign: 'left',
                }}
              >
                <span style={{ color: 'hsl(var(--muted-foreground))' }}>
                  <FileText className="csp-icon-md" />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {cv.fileName || cv.label || 'Untitled CV'}
                  </div>
                  <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', marginTop: 2 }}>
                    {cv.label && cv.label !== cv.fileName ? `${cv.label} · ` : ''}Uploaded {cv.uploadedAt || '—'}
                  </div>
                </div>
                {cv.isPrimary && (
                  <span style={{ color: '#f59e0b', fontSize: 16 }} title="Primary CV">★</span>
                )}
                <span
                  style={{
                    width: 16, height: 16, borderRadius: '50%',
                    border: '2px solid ' + (active ? 'hsl(var(--primary))' : 'hsl(var(--border))'),
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {active && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'hsl(var(--primary))' }} />}
                </span>
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <button type="button" className="csp-btn csp-btn-outline" onClick={onCancel}>Cancel</button>
          <button
            type="button" className="csp-btn csp-btn-primary"
            disabled={!selected}
            onClick={() => selected && onPick(selected)}
          >Use this CV</button>
        </div>
      </div>
    </Dialog>
  );
}
