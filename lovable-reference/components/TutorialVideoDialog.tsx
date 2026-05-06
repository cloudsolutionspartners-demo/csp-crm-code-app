import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { GraduationCap, Play, X } from 'lucide-react';

interface TutorialVideo {
  id: string;
  title: string;
  description: string;
  duration: string;
  videoUrl: string;
}

interface TutorialVideoDialogProps {
  videos: TutorialVideo[];
  entityLabel: string;
}

export function TutorialVideoButton({ videos, entityLabel }: TutorialVideoDialogProps) {
  const [showList, setShowList] = useState(false);
  const [playingVideo, setPlayingVideo] = useState<TutorialVideo | null>(null);

  return (
    <>
      <Button variant="outline" onClick={() => setShowList(true)}>
        <GraduationCap className="h-4 w-4 mr-2" />
        Learn How To
      </Button>

      {/* Video List Dialog */}
      <Dialog open={showList} onOpenChange={setShowList}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              <GraduationCap className="h-5 w-5 inline mr-2" />
              {entityLabel} Tutorials
            </DialogTitle>
            <DialogDescription>
              Watch step-by-step video guides to learn how to work with {entityLabel.toLowerCase()}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 mt-2">
            {videos.map(video => (
              <button
                key={video.id}
                onClick={() => {
                  setShowList(false);
                  setPlayingVideo(video);
                }}
                className="w-full flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors text-left group"
              >
                <div className="flex-shrink-0 h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Play className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{video.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{video.description}</p>
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0">{video.duration}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Video Player Dialog */}
      <Dialog open={!!playingVideo} onOpenChange={open => { if (!open) setPlayingVideo(null); }}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          <div className="relative">
            <div className="flex items-center justify-between px-4 py-3 border-b bg-card">
              <div>
                <h3 className="text-sm font-semibold">{playingVideo?.title}</h3>
                <p className="text-xs text-muted-foreground">{playingVideo?.description}</p>
              </div>
            </div>
            <div className="bg-black aspect-video w-full">
              {playingVideo && (
                <video
                  key={playingVideo.id}
                  src={playingVideo.videoUrl}
                  controls
                  autoPlay
                  className="w-full h-full"
                  controlsList="nodownload"
                >
                  Your browser does not support the video tag.
                </video>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
