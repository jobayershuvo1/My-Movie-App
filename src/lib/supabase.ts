// Local SQLite compatibility client. The existing UI uses Supabase-style query
// chains, while all persistence is handled by the Express SQLite API.

type QueryResult = { data: any; error: { message: string } | null; count: number | null };
type Filter = { column: string; operator: 'eq' | 'neq' | 'ilike'; value: unknown };

class LocalQuery implements PromiseLike<QueryResult> {
  private action = 'select';
  private payload: unknown = null;
  private selection = '*';
  private filters: Filter[] = [];
  private orExpression?: string;
  private orderBy?: { column: string; ascending: boolean };
  private rowLimit?: number;
  private head = false;
  private countMode?: string;
  private singleRow = false;

  constructor(private table: string) {}

  select(selection = '*', options?: { count?: string; head?: boolean }) {
    this.selection = selection;
    this.countMode = options?.count;
    this.head = Boolean(options?.head);
    return this;
  }

  insert(payload: unknown) {
    this.action = 'insert';
    this.payload = payload;
    return this;
  }

  upsert(payload: unknown) {
    this.action = 'upsert';
    this.payload = payload;
    return this;
  }

  update(payload: unknown) {
    this.action = 'update';
    this.payload = payload;
    return this;
  }

  delete() {
    this.action = 'delete';
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, operator: 'eq', value });
    return this;
  }

  neq(column: string, value: unknown) {
    this.filters.push({ column, operator: 'neq', value });
    return this;
  }

  ilike(column: string, value: unknown) {
    this.filters.push({ column, operator: 'ilike', value });
    return this;
  }

  or(expression: string) {
    this.orExpression = expression;
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderBy = { column, ascending: options?.ascending !== false };
    return this;
  }

  limit(value: number) {
    this.rowLimit = value;
    return this;
  }

  single() {
    this.singleRow = true;
    return this;
  }

  private async execute(): Promise<QueryResult> {
    try {
      const response = await fetch('/api/local-db/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: this.table,
          action: this.action,
          payload: this.payload,
          selection: this.selection,
          filters: this.filters,
          orExpression: this.orExpression,
          order: this.orderBy,
          limit: this.rowLimit,
          head: this.head,
          count: this.countMode,
        }),
      });
      const result = await response.json();
      if (this.singleRow && Array.isArray(result.data)) result.data = result.data[0] ?? null;
      return result;
    } catch (error: any) {
      return { data: null, count: null, error: { message: error.message || 'Local database request failed.' } };
    }
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

type AuthCallback = (event: string, session: any) => void | Promise<void>;
const authCallbacks = new Set<AuthCallback>();
const SESSION_KEY = 'cinevault_sqlite_session';

function readSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
}

function saveSession(session: any) {
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else localStorage.removeItem(SESSION_KEY);
}

async function authRequest(path: string, body: Record<string, unknown>) {
  try {
    const response = await fetch(`/api/local-db/auth/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return await response.json();
  } catch (error: any) {
    return { data: null, error: { message: error.message || 'Local authentication failed.' } };
  }
}

const auth = {
  async getSession() {
    return { data: { session: readSession() }, error: null };
  },
  async signInWithPassword({ email, password }: { email: string; password: string }) {
    const result = await authRequest('login', { email, password });
    if (!result.error && result.data?.session) {
      saveSession(result.data.session);
      for (const callback of authCallbacks) await callback('SIGNED_IN', result.data.session);
    }
    return result;
  },
  async signUp({ email, password, options }: { email: string; password: string; options?: any }) {
    const result = await authRequest('register', { email, password, fullName: options?.data?.full_name });
    if (!result.error && result.data?.session) {
      saveSession(result.data.session);
      for (const callback of authCallbacks) await callback('SIGNED_IN', result.data.session);
    }
    return result;
  },
  async signOut() {
    saveSession(null);
    for (const callback of authCallbacks) await callback('SIGNED_OUT', null);
    return { error: null };
  },
  onAuthStateChange(callback: AuthCallback) {
    authCallbacks.add(callback);
    return { data: { subscription: { unsubscribe: () => authCallbacks.delete(callback) } } };
  },
  async resetPasswordForEmail(email: string) {
    const { data } = await new LocalQuery('profiles').select('id').eq('email', email).single();
    return data
      ? { data: {}, error: null }
      : { data: null, error: { message: 'No local account was found for this email.' } };
  },
  async updateUser({ password }: { password: string }) {
    const session = readSession();
    if (!session?.user?.id) return { data: null, error: { message: 'Please sign in first.' } };
    return authRequest('password', { userId: session.user.id, password });
  },
};

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

const storage = {
  from(_bucket: string) {
    return {
      async upload(filePath: string, file: File) {
        try {
          const response = await fetch('/api/local-db/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: filePath, dataUrl: await fileToDataUrl(file) }),
          });
          return await response.json();
        } catch (error: any) {
          return { data: null, error: { message: error.message || 'Upload failed.' } };
        }
      },
      getPublicUrl(filePath: string) {
        return { data: { publicUrl: `/uploads/${filePath}` } };
      },
    };
  },
};

class LocalChannel {
  on(_event: string, _filter: unknown, _callback: (payload: unknown) => void) { return this; }
  subscribe() { return this; }
}

export const isDatabaseConfigured = true;
export const isSupabaseConfigured = isDatabaseConfigured;
export const supabase: any = {
  from: (table: string) => new LocalQuery(table),
  auth,
  storage,
  channel: (_name: string) => new LocalChannel(),
  removeChannel: (_channel: LocalChannel) => undefined,
};
