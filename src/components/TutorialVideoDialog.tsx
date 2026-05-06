import * as React from 'react';
import { useState } from 'react';
import { Dialog } from './Layout';
import { GraduationCap, Play } from './Icons';
import { Spinner } from './Shared';
import { fetchVideosByModule } from '../services/learnHowToVideoService';
import type { VideoRecord } from '../services/learnHowToVideoService';

interface TutorialVideoButtonProps {
  moduleLabel: string;
  entityLabel: string;
}

export function TutorialVideoButton({ moduleLabel, entityLabel }: TutorialVideoButtonProps) {
  const [showList, setShowList] = useState(false);
  const [videos, setVideos] = useState<VideoRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<VideoRecord | null>(null);

  const openList = async () => {
    setShowList(true);
    setLoading(true);
    try {
      const records = await fetchVideosByModule(moduleLabel);
      setVideos(records);
    } catch (err) {
      console.error('[TutorialVideo] Failed to fetch videos:', err);
      setVideos([]);
    } finally {
      setLoading(false);
    }
  };

  const selectVideo = (video: VideoRecord) => {
    setShowList(false);
    setSelectedVideo(video);
  };

  const watchVideo = () => {
    if (!selectedVideo) return;
    window.open(selectedVideo.link, '_blank');
  };

  return (
    <>
      <button className="csp-btn csp-btn-outline" onClick={openList}>
        <GraduationCap className="csp-icon-inline" /> Learn How To
      </button>

      {/* Video List Dialog */}
      <Dialog open={showList} onClose={() => setShowList(false)} title={`${entityLabel} Tutorials`} maxWidth="36rem">
        <p style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))', marginBottom: 12 }}>
          Watch step-by-step video guides to learn how to work with {entityLabel.toLowerCase()}.
        </p>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 0', gap: 8 }}>
            <Spinner size="sm" /> <span style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))' }}>Loading videos...</span>
          </div>
        ) : videos.length === 0 ? (
          <p style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))', textAlign: 'center', padding: '2rem 0' }}>
            No tutorial videos available for this module yet.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {videos.map(video => (
              <button
                key={video.id}
                onClick={() => selectVideo(video)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 8, border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--card))', cursor: 'pointer', textAlign: 'left', transition: 'background-color 150ms' }}
                className="csp-tutorial-item"
              >
                <div style={{ flexShrink: 0, height: 40, width: 40, borderRadius: 6, backgroundColor: 'hsl(var(--primary) / 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: 'hsl(var(--primary))' }}><Play className="csp-icon-inline" /></span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '0.875rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{video.title}</p>
                  <p style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{video.description}</p>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'hsl(var(--primary))', flexShrink: 0, fontWeight: 500 }}>Watch</span>
              </button>
            ))}
          </div>
        )}
      </Dialog>

      {/* Video Detail Dialog */}
      <Dialog open={!!selectedVideo} onClose={() => setSelectedVideo(null)} title={selectedVideo?.title || 'Tutorial'} maxWidth="28rem">
        {selectedVideo && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '1rem 0' }}>
            <div style={{ width: 72, height: 72, borderRadius: 16, backgroundColor: 'hsl(var(--primary) / 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <span style={{ color: 'hsl(var(--primary))' }}><Play className="csp-icon-lg" /></span>
            </div>

            <p style={{ fontSize: '0.875rem', color: 'hsl(var(--foreground))', textAlign: 'center', margin: '0 0 4px', fontWeight: 500 }}>
              {selectedVideo.title}
            </p>
            {selectedVideo.description && (
              <p style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))', textAlign: 'center', margin: '0 0 20px', lineHeight: 1.5 }}>
                {selectedVideo.description}
              </p>
            )}

            <button
              className="csp-btn csp-btn-primary"
              onClick={watchVideo}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 24px', fontSize: '0.875rem' }}
            >
              <Play className="csp-icon-inline" /> Watch Tutorial
            </button>

            <p style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', marginTop: 10 }}>
              Video will open in a new tab
            </p>
          </div>
        )}
      </Dialog>
    </>
  );
}
