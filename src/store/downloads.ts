import { create } from 'zustand';

export interface DownloadItem {
  id: string;
  userId: string;
  movieId: string;
  movieTitle: string;
  posterUrl: string | null;
  serverName: string;
  quality: string;
  fileSize: string;
  progress: number;
  status: 'queued' | 'downloading' | 'completed' | 'paused' | 'failed';
  downloadSpeed: string;
  timeLeft: string;
  createdAt: string;
  downloadUrl: string;
}

interface DownloadState {
  downloads: DownloadItem[];
  loadDownloads: (userId: string) => void;
  startDownload: (userId: string, movie: { id: string; title: string; poster_url: string | null }, link: { id: string; server_name: string; quality: string; file_size: string | null; url: string }) => void;
  pauseDownload: (id: string) => void;
  resumeDownload: (id: string) => void;
  cancelDownload: (id: string) => void;
  clearHistory: (userId: string) => void;
}

let activeInterval: NodeJS.Timeout | null = null;

export const useDownloadStore = create<DownloadState>((set, get) => {
  // Start simulation loop for any ongoing downloads
  const startSimulationLoop = () => {
    if (activeInterval) return;

    activeInterval = setInterval(() => {
      const { downloads } = get();
      const activeDownloads = downloads.filter((d) => d.status === 'downloading');

      if (activeDownloads.length === 0) {
        if (activeInterval) {
          clearInterval(activeInterval);
          activeInterval = null;
        }
        return;
      }

      const updatedDownloads = downloads.map((d) => {
        if (d.status !== 'downloading') return d;

        // Progress increment between 3% and 12%
        const increment = Math.round(Math.random() * 9 + 3);
        const nextProgress = Math.min(d.progress + increment, 100);
        
        let nextStatus: DownloadItem['status'] = d.status;
        let speed = d.downloadSpeed;
        let timeRemaining = d.timeLeft;

        if (nextProgress >= 100) {
          nextStatus = 'completed';
          speed = '0 KB/s';
          timeRemaining = 'Completed';
        } else {
          // Dynamic download speeds (e.g., 2.5 MB/s to 12.0 MB/s)
          const speedNum = (Math.random() * 9.5 + 2.5).toFixed(1);
          speed = `${speedNum} MB/s`;

          // Calculate approximate simulated remaining time based on speed and size
          const sizeInGb = parseFloat(d.fileSize) || 1.8;
          const remainingGb = sizeInGb * (1 - nextProgress / 100);
          const remainingMb = remainingGb * 1024;
          const speedMb = parseFloat(speedNum);
          const secondsLeft = Math.round(remainingMb / speedMb);

          if (secondsLeft < 60) {
            timeRemaining = `${secondsLeft}s left`;
          } else {
            const mins = Math.floor(secondsLeft / 60);
            const secs = secondsLeft % 60;
            timeRemaining = `${mins}m ${secs}s left`;
          }
        }

        return {
          ...d,
          progress: nextProgress,
          status: nextStatus as any,
          downloadSpeed: speed,
          timeLeft: timeRemaining,
        };
      });

      // Save to localStorage of the current user(s)
      set({ downloads: updatedDownloads });

      // Group and save in localStorage by userId
      const userIds = Array.from(new Set(updatedDownloads.map(d => d.userId)));
      userIds.forEach(uid => {
        const userDls = updatedDownloads.filter(d => d.userId === uid);
        localStorage.setItem(`cinevault_downloads_user_${uid}`, JSON.stringify(userDls));
      });
    }, 1500);
  };

  return {
    downloads: [],

    loadDownloads: (userId: string) => {
      const stored = localStorage.getItem(`cinevault_downloads_user_${userId}`);
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as DownloadItem[];
          set({ downloads: parsed });
          // If any were in 'downloading' or 'queued' state, resume simulation
          if (parsed.some(d => d.status === 'downloading')) {
            startSimulationLoop();
          }
        } catch (e) {
          console.warn('Error parsing downloads in store:', e);
        }
      } else {
        set({ downloads: [] });
      }
    },

    startDownload: (userId, movie, link) => {
      const { downloads } = get();
      
      // Look for already existing active download for the exact same movie and quality to avoid duplicates
      const existing = downloads.find(
        (d) => d.userId === userId && d.movieId === movie.id && d.quality === link.quality && d.status !== 'completed'
      );

      if (existing) {
        // Just resume it or do nothing if downloading
        if (existing.status === 'paused') {
          get().resumeDownload(existing.id);
        }
        return;
      }

      const sizeStr = link.file_size || '1.8 GB';
      const newDownload: DownloadItem = {
        id: `${movie.id}_${Date.now()}_${link.quality.replace(/\s+/g, '_')}`,
        userId,
        movieId: movie.id,
        movieTitle: movie.title,
        posterUrl: movie.poster_url,
        serverName: link.server_name,
        quality: link.quality,
        fileSize: sizeStr,
        progress: 0,
        status: 'downloading',
        downloadSpeed: 'Calculating...',
        timeLeft: 'Calculating...',
        createdAt: new Date().toISOString(),
        downloadUrl: link.url
      };

      const nextDownloads = [newDownload, ...downloads];
      set({ downloads: nextDownloads });
      localStorage.setItem(`cinevault_downloads_user_${userId}`, JSON.stringify(nextDownloads.filter(d => d.userId === userId)));
      
      startSimulationLoop();
    },

    pauseDownload: (id) => {
      const { downloads } = get();
      const updated = downloads.map((d) => {
        if (d.id !== id) return d;
        return {
          ...d,
          status: 'paused' as const,
          downloadSpeed: '0 KB/s',
          timeLeft: 'Paused'
        };
      });

      set({ downloads: updated });
      // Save for respective user
      const item = downloads.find(d => d.id === id);
      if (item) {
        localStorage.setItem(`cinevault_downloads_user_${item.userId}`, JSON.stringify(updated.filter(d => d.userId === item.userId)));
      }
    },

    resumeDownload: (id) => {
      const { downloads } = get();
      const updated = downloads.map((d) => {
        if (d.id !== id) return d;
        return {
          ...d,
          status: 'downloading' as const,
          downloadSpeed: 'Connecting...',
          timeLeft: 'Connecting...'
        };
      });

      set({ downloads: updated });
      const item = downloads.find(d => d.id === id);
      if (item) {
        localStorage.setItem(`cinevault_downloads_user_${item.userId}`, JSON.stringify(updated.filter(d => d.userId === item.userId)));
      }

      startSimulationLoop();
    },

    cancelDownload: (id) => {
      const { downloads } = get();
      const updated = downloads.filter((d) => d.id !== id);

      set({ downloads: updated });
      const item = downloads.find(d => d.id === id);
      if (item) {
        localStorage.setItem(`cinevault_downloads_user_${item.userId}`, JSON.stringify(updated.filter(d => d.userId === item.userId)));
      }
    },

    clearHistory: (userId) => {
      const { downloads } = get();
      // Keep active downloads (downloading, queued, paused), clear completed/failed
      const remaining = downloads.filter((d) => d.userId !== userId || ['downloading', 'queued', 'paused'].includes(d.status));
      set({ downloads: remaining });
      localStorage.setItem(`cinevault_downloads_user_${userId}`, JSON.stringify(remaining.filter(d => d.userId === userId)));
    }
  };
});
