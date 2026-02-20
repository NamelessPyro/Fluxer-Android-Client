import { FLUXER_API_BASE_URL } from '../config/api';

// Demo mode - set to true to use mock data instead of real API
const DEMO_MODE = false;

interface DiscoveryDocument {
  endpoints: {
    api: string;
    api_client: string;
    gateway: string;
    [key: string]: string;
  };
  [key: string]: any;
}

interface AuthResponse {
  token: string;
  user_id?: string;
  user?: {
    id: string;
    username: string;
    email: string;
    avatar?: string;
  };
}

interface IpAuthorizationRequiredResponse {
  ip_authorization_required: true;
  ticket: string;
  email: string;
  resend_available_in: number;
}

interface IpAuthorizationPollResult {
  completed: boolean;
  token?: string;
  user_id?: string;
}

interface Channel {
  id: string;
  name?: string;
  description?: string;
  type: string | number;
  guild_id?: string;
  recipients?: Array<{ id: string; username: string; avatar?: string }>;
}

interface Guild {
  id: string;
  name?: string;
  icon?: string;
  owner_id?: string;
}

interface Message {
  id: string;
  content: string;
  author_id: string;
  author?: {
    id: string;
    username: string;
    avatar?: string;
  };
  channel_id: string;
  created_at: string;
  attachments?: Array<{
    id: string;
    filename: string;
    size?: number;
    content_type?: string;
    url?: string;
    proxy_url?: string;
    width?: number;
    height?: number;
    placeholder?: string;
  }>;
}

class FluxerAPI {
  private baseURL: string;
  private token: string | null = null;
  private discoveryCache: DiscoveryDocument | null = null;
  private apiEndpoint: string = '/api/v1';

  constructor(baseURL: string = FLUXER_API_BASE_URL) {
    this.baseURL = baseURL;
    console.log('[FluxerAPI] Initialized with base URL:', baseURL);
  }

  setToken(token: string) {
    this.token = token;
  }

  private normalizeAttachment(raw: any): NonNullable<Message['attachments']>[number] {
    return {
      id: String(raw?.id ?? ''),
      filename: String(raw?.filename ?? ''),
      size: typeof raw?.size === 'number' ? raw.size : undefined,
      content_type: typeof raw?.content_type === 'string' ? raw.content_type : undefined,
      url: typeof raw?.url === 'string' ? raw.url : undefined,
      proxy_url: typeof raw?.proxy_url === 'string' ? raw.proxy_url : undefined,
      width: typeof raw?.width === 'number' ? raw.width : undefined,
      height: typeof raw?.height === 'number' ? raw.height : undefined,
      placeholder: typeof raw?.placeholder === 'string' ? raw.placeholder : undefined,
    };
  }

  private normalizeMessage(raw: any): Message {
    const createdAt =
      raw?.created_at ??
      raw?.timestamp ??
      raw?.createdAt ??
      raw?.created_at_iso;

    const authorRaw = raw?.author;
    const author = authorRaw
      ? {
          id: String(authorRaw?.id ?? ''),
          username: String(authorRaw?.username ?? ''),
          avatar: typeof authorRaw?.avatar === 'string' ? authorRaw.avatar : undefined,
        }
      : undefined;

    const attachmentsRaw = Array.isArray(raw?.attachments) ? raw.attachments : undefined;

    return {
      id: String(raw?.id ?? ''),
      content: String(raw?.content ?? ''),
      author_id: String(raw?.author_id ?? author?.id ?? ''),
      author,
      channel_id: String(raw?.channel_id ?? raw?.channelId ?? ''),
      created_at: createdAt ? String(createdAt) : '',
      attachments: attachmentsRaw?.map((a: any) => this.normalizeAttachment(a)),
    };
  }

  private getHeaders(captchaToken?: string, captchaType?: string): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    // Use the captcha type from discovery (e.g., 'turnstile' or 'hcaptcha')
    if (captchaToken) {
      headers['X-Captcha-Token'] = captchaToken;
      // If captchaType is provided, use it; otherwise default to turnstile
      headers['X-Captcha-Type'] = captchaType || 'hcaptcha';
    }
    return headers;
  }

  // Discover the correct API endpoints from the server
  private async discoverEndpoints(): Promise<DiscoveryDocument> {
    if (this.discoveryCache) {
      return this.discoveryCache;
    }

    try {
      const url = `${this.baseURL}/v1/.well-known/fluxer`;
      console.log('[FluxerAPI] Discovering endpoints from:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        console.warn(`[FluxerAPI] Discovery endpoint returned ${response.status}, using default paths`);
        return {
          endpoints: {
            api: this.baseURL,
            api_client: this.baseURL,
            gateway: this.baseURL.replace('https://', 'wss://').replace('http://', 'ws://'),
          },
        };
      }

      const data = await response.json();
      console.log('[FluxerAPI] Discovery successful:', data.endpoints);
      this.discoveryCache = data;
      return data;
    } catch (error) {
      console.warn('[FluxerAPI] Discovery failed, using default paths:', error);
      return {
        endpoints: {
          api: this.baseURL,
          api_client: this.baseURL,
          gateway: this.baseURL.replace('https://', 'wss://').replace('http://', 'ws://'),
        },
      };
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    captchaToken?: string,
    captchaType?: string
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    return this.requestUrl<T>(url, endpoint, options, captchaToken, captchaType);
  }

  private async getClientBaseURL(): Promise<string> {
    const discovery = await this.discoverEndpoints();
    return discovery.endpoints?.api_client || discovery.endpoints?.api || this.baseURL;
  }

  private normalizeClientEndpoint(endpoint: string): string {
    // For client endpoints, discovery base already includes `/api`.
    // Most of our internal paths are `/api/v1/*`, so strip the leading `/api`.
    if (endpoint.startsWith('/api/')) {
      return endpoint.replace(/^\/api/, '');
    }
    return endpoint;
  }

  private async requestClient<T>(
    endpoint: string,
    options: RequestInit = {},
    captchaToken?: string,
    captchaType?: string
  ): Promise<T> {
    const discovery = await this.discoverEndpoints();
    const base = discovery.endpoints?.api_client || discovery.endpoints?.api || this.baseURL;
    const normalized = this.normalizeClientEndpoint(endpoint);
    const url = `${base}${normalized}`;

    // Fluxer rejects some write requests without a valid web Origin.
    const webappOrigin = discovery.endpoints?.webapp || discovery.endpoints?.marketing || 'https://web.fluxer.app';
    const extraHeaders: HeadersInit = {
      Origin: webappOrigin,
      Referer: `${webappOrigin}/`,
      'X-Requested-With': 'XMLHttpRequest',
    };

    return this.requestUrl<T>(
      url,
      normalized,
      {
        ...options,
        headers: {
          ...(options.headers as any),
          ...(extraHeaders as any),
        },
      },
      captchaToken,
      captchaType
    );
  }

  private async requestUrl<T>(
    url: string,
    logEndpoint: string,
    options: RequestInit = {},
    captchaToken?: string,
    captchaType?: string
  ): Promise<T> {
    const method = options.method || 'GET';

    console.log(`[FluxerAPI] ${method} ${logEndpoint}`);
    console.log(`[FluxerAPI] Full URL: ${url}`);
    if (options.body) {
      console.log(`[FluxerAPI] Body:`, options.body);
    }

    try {
      const isFormDataBody = (() => {
        const body: any = (options as any)?.body;
        return !!body && typeof body === 'object' && typeof body.append === 'function' && Array.isArray(body._parts);
      })();

      const mergedHeaders: Record<string, any> = {
        ...(this.getHeaders(captchaToken, captchaType) as any),
        ...(options.headers as any),
      };

      // Let React Native set the multipart boundary.
      if (isFormDataBody) {
        delete mergedHeaders['Content-Type'];
        delete mergedHeaders['content-type'];
      }

      const response = await fetch(url, {
        ...options,
        headers: mergedHeaders,
      });

      const status = response.status;
      console.log(`[FluxerAPI] Response status: ${status}`);

      if (!response.ok) {
        let errorData: any = {};
        try {
          errorData = await response.json();
          console.log(`[FluxerAPI] Error response:`, errorData);
        } catch (e) {
          const text = await response.text();
          console.log(`[FluxerAPI] Error response (text):`, text);
        }

        if (status === 403 && errorData?.code === 'IP_AUTHORIZATION_REQUIRED') {
          console.log('[FluxerAPI] IP authorization required, returning response');
          return errorData as T;
        }

        throw new Error(errorData?.message || `HTTP ${status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`[FluxerAPI] Success response:`, data);
      return data;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[FluxerAPI] Request failed: ${errorMsg}`);
      throw error;
    }
  }

  // Try multiple endpoint variations
  private async tryRequest<T>(
    endpoints: string[],
    options: RequestInit = {},
    captchaToken?: string,
    captchaType?: string
  ): Promise<T> {
    const errors: string[] = [];
    let hasCaptchaError = false;

    for (const endpoint of endpoints) {
      try {
        console.log(`[FluxerAPI] Trying endpoint: ${endpoint}`);
        return await this.request<T>(endpoint, options, captchaToken, captchaType);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push(`${endpoint}: ${errorMsg}`);
        
        // Check if this is a CAPTCHA error
        if (errorMsg.includes('CAPTCHA') || errorMsg.includes('Captcha')) {
          hasCaptchaError = true;
        }
        
        console.warn(`[FluxerAPI] Endpoint failed, trying next...`);
      }
    }

    // If all endpoints failed with CAPTCHA error, throw that specifically
    if (hasCaptchaError && errors.length > 0) {
      throw new Error('CAPTCHA_REQUIRED: Captcha is required.');
    }

    throw new Error(`All endpoints failed:\n${errors.join('\n')}`);
  }

  // Authentication
  async login(email: string, password: string, captchaToken?: string): Promise<AuthResponse | IpAuthorizationRequiredResponse> {
    if (DEMO_MODE) {
      // Demo mode - simulate login
      return Promise.resolve({
        token: 'demo-token-' + Date.now(),
        user: {
          id: '1',
          username: email.split('@')[0],
          email,
        },
      });
    }

    // First, try to get discovery info which includes captcha config
    try {
      const discovery = await this.discoverEndpoints();
      console.log('[FluxerAPI] Discovery info:', discovery);
    } catch (e) {
      console.warn('[FluxerAPI] Could not fetch discovery');
    }

    // The correct endpoints are /auth/login or /v1/auth/login
    // They require a captcha token passed as X-Captcha-Token header
    const loginEndpoints = [
      '/auth/login',
      '/v1/auth/login',
    ];

    return this.tryRequest<AuthResponse | IpAuthorizationRequiredResponse>(loginEndpoints, {
      method: 'POST',
      body: JSON.stringify({ 
        email, 
        password,
      }),
    }, captchaToken, 'hcaptcha');
  }

  async register(
    email: string,
    password: string,
    username: string,
    captchaToken?: string
  ): Promise<AuthResponse> {
    if (DEMO_MODE) {
      return Promise.resolve({
        token: 'demo-token-' + Date.now(),
        user: {
          id: Math.random().toString(),
          username,
          email,
        },
      });
    }

    const endpoints = ['/auth/register', '/v1/auth/register'];
    
    return this.tryRequest<AuthResponse>(endpoints, {
      method: 'POST',
      body: JSON.stringify({ 
        email, 
        password, 
        username,
      }),
    }, captchaToken);
  }

  async getCurrentUser() {
    return this.requestClient('/api/v1/users/@me', {
      method: 'GET',
    });
  }

  // IP Authorization (email-based authorization for new IPs)
  async pollIpAuthorization(ticket: string): Promise<IpAuthorizationPollResult> {
    const endpoints = [
      `/auth/ip-authorization/poll?ticket=${ticket}`,
      `/v1/auth/ip-authorization/poll?ticket=${ticket}`,
    ];
    
    return this.tryRequest<IpAuthorizationPollResult>(endpoints, {
      method: 'GET',
    });
  }

  async resendIpAuthorization(ticket: string): Promise<void> {
    const endpoints = [
      `/auth/ip-authorization/resend?ticket=${ticket}`,
      `/v1/auth/ip-authorization/resend?ticket=${ticket}`,
    ];
    
    return this.tryRequest<void>(endpoints, {
      method: 'POST',
    });
  }

  // Channels
  async getChannels(): Promise<Channel[]> {
    if (DEMO_MODE) {
      return Promise.resolve([
        { id: '1', name: 'general', description: 'General chat', type: 'text' },
        { id: '2', name: 'random', description: 'Random discussions', type: 'text' },
        { id: '3', name: 'announcements', description: 'Important announcements', type: 'text' },
      ]);
    }
    
    const result = await this.requestClient<any>('/api/v1/users/@me/channels', { method: 'GET' });
    const channelsRaw = Array.isArray(result)
      ? result
      : (result?.channels && Array.isArray(result.channels))
        ? result.channels
        : null;

    if (!channelsRaw) {
      throw new Error('Unexpected channels response shape');
    }

    const channels: Channel[] = channelsRaw.map((ch: any) => {
      const recipients = Array.isArray(ch?.recipients) ? ch.recipients : undefined;
      const derivedName = !ch?.name && recipients?.length
        ? recipients.map((r: any) => r?.username).filter(Boolean).join(', ')
        : undefined;

      return {
        id: String(ch?.id),
        name: ch?.name || derivedName || 'Direct Message',
        description: ch?.description,
        type: ch?.type ?? 'unknown',
        guild_id: ch?.guild_id,
        recipients,
      } as Channel;
    });

    return channels;
  }

  async getChannel(channelId: string): Promise<Channel> {
    return this.requestClient<Channel>(`/api/v1/channels/${channelId}`, {
      method: 'GET',
    });
  }

  // Servers (Guilds)
  async getGuilds(): Promise<Guild[]> {
    const result = await this.requestClient<any>('/api/v1/users/@me/guilds', { method: 'GET' });
    const guildsRaw = Array.isArray(result)
      ? result
      : (result?.guilds && Array.isArray(result.guilds))
        ? result.guilds
        : null;

    if (!guildsRaw) {
      throw new Error('Unexpected guilds response shape');
    }

    return guildsRaw.map((g: any) => ({
      id: String(g?.id),
      name: g?.name,
      icon: g?.icon,
      owner_id: g?.owner_id,
    })) as Guild[];
  }

  async getGuildChannels(guildId: string): Promise<Channel[]> {
    const result = await this.requestClient<any>(`/api/v1/guilds/${guildId}/channels`, { method: 'GET' });
    const channelsRaw = Array.isArray(result)
      ? result
      : (result?.channels && Array.isArray(result.channels))
        ? result.channels
        : null;

    if (!channelsRaw) {
      throw new Error('Unexpected guild channels response shape');
    }

    return channelsRaw.map((ch: any) => ({
      id: String(ch?.id),
      name: ch?.name,
      description: ch?.description,
      type: ch?.type ?? 'unknown',
      guild_id: ch?.guild_id ?? String(guildId),
    })) as Channel[];
  }

  // Messages
  async getMessages(
    channelId: string,
    limit: number = 50,
    before?: string
  ): Promise<Message[]> {
    if (DEMO_MODE) {
      return Promise.resolve([
        {
          id: '1',
          content: 'Welcome to #' + channelId + '!',
          author_id: 'system',
          author: { id: 'system', username: 'System' },
          channel_id: channelId,
          created_at: new Date().toISOString(),
        },
      ]);
    }
    let endpoint = `/api/v1/channels/${channelId}/messages?limit=${limit}`;
    if (before) {
      endpoint += `&before=${before}`;
    }
    const raw = await this.requestClient<any>(endpoint, {
      method: 'GET',
    });

    const list = Array.isArray(raw)
      ? raw
      : (raw?.messages && Array.isArray(raw.messages))
        ? raw.messages
        : null;

    if (!list) {
      throw new Error('Unexpected messages response shape');
    }

    return list.map((m: any) => this.normalizeMessage(m));
  }

  async sendMessage(
    channelId: string,
    content: string
  ): Promise<Message> {
    if (DEMO_MODE) {
      return Promise.resolve({
        id: Math.random().toString(),
        content,
        author_id: this.token || 'user',
        channel_id: channelId,
        created_at: new Date().toISOString(),
      });
    }
    const raw = await this.requestClient<any>(
      `/api/v1/channels/${channelId}/messages`,
      {
        method: 'POST',
        body: JSON.stringify({ content }),
      }
    );

    return this.normalizeMessage(raw);
  }

  async sendMessageWithImage(
    channelId: string,
    content: string,
    image: { uri: string; name: string; type: string }
  ): Promise<Message> {
    const form = new FormData();
    const filename = image?.name?.trim() ? image.name.trim() : `upload-${Date.now()}.jpg`;
    const payload = {
      content,
      // Fluxer requires attachment metadata when uploading files.
      attachments: [{ id: 0, filename }],
    };

    // Discord-style multipart fields.
    form.append('payload_json', JSON.stringify(payload));
    form.append('files[0]', {
      uri: image.uri,
      name: filename,
      type: image.type,
    } as any);

    const raw = await this.requestClient<any>(
      `/api/v1/channels/${channelId}/messages`,
      {
        method: 'POST',
        body: form as any,
      }
    );

    return this.normalizeMessage(raw);
  }

  async editMessage(
    channelId: string,
    messageId: string,
    content: string
  ): Promise<Message> {
    const raw = await this.requestClient<any>(
      `/api/v1/channels/${channelId}/messages/${messageId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ content }),
      }
    );

    return this.normalizeMessage(raw);
  }

  async deleteMessage(
    channelId: string,
    messageId: string
  ): Promise<void> {
    return this.requestClient<void>(
      `/api/v1/channels/${channelId}/messages/${messageId}`,
      {
        method: 'DELETE',
      }
    );
  }
}

export const fluxerAPI = new FluxerAPI();
export type { AuthResponse, Channel, Guild, Message };
