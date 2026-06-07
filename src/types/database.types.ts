export type Movie = Database['public']['Tables']['movies']['Row'];
export type DownloadLink = Database['public']['Tables']['download_links']['Row'];
export type Category = Database['public']['Tables']['categories']['Row'];
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type MovieRating = Database['public']['Tables']['movie_ratings']['Row'];
export type Notification = Database['public']['Tables']['notifications']['Row'];
export type ActivityLog = Database['public']['Tables']['activity_logs']['Row'];

// Database type stubs based on schema
export interface Database {
  public: {
    Tables: {
      movies: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          poster_url: string | null;
          cover_url: string | null;
          trailer_url: string | null;
          release_year: number | null;
          imdb_rating: number | null;
          runtime: number | null;
          language: string | null;
          country: string | null;
          download_enabled: boolean;
          featured: boolean;
          trending: boolean;
          published: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['movies']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['movies']['Insert']>;
      };
      download_links: {
        Row: {
          id: string;
          movie_id: string;
          server_name: string;
          url: string;
          quality: string;
          file_size: string | null;
          status: 'active' | 'broken' | 'maintenance';
          clicks: number;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['download_links']['Row'], 'id' | 'created_at' | 'clicks'>;
        Update: Partial<Database['public']['Tables']['download_links']['Insert']>;
      };
      categories: {
        Row: {
          id: string;
          name: string;
          slug: string;
          type: 'genre' | 'category';
        };
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          role: 'super_admin' | 'admin' | 'moderator' | 'editor' | 'user';
          created_at: string;
          updated_at: string;
        };
      };
      movie_ratings: {
        Row: {
          id: string;
          movie_id: string;
          user_id: string;
          rating: number;
          review_text: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['movie_ratings']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['movie_ratings']['Insert']>;
      };
      notifications: {
        Row: {
          id: string;
          user_id: string | null;
          title: string;
          message: string;
          type: 'request_status' | 'new_movie' | 'general';
          read: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['notifications']['Row'], 'id' | 'created_at' | 'read'>;
        Update: Partial<Database['public']['Tables']['notifications']['Row']>;
      };
      activity_logs: {
        Row: {
          id: string;
          user_id: string | null;
          action: string;
          details: string;
          ip_address: string | null;
          metadata: any;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['activity_logs']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['activity_logs']['Row']>;
      };
    };
  };
}
