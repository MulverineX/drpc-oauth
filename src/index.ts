const API = 'https://discord.com/api/v10';

export enum ActivityType {
  /**
   * Member List: `Playing **_** 🗎`
   *
   * Profile: `PLAYING A GAME`
   */
  Playing,
  /** 
   * Member List: `Playing **_** 🗎`
   *
   * Profile:
   * - `LIVE ON TWITCH` (yes)
   * - Replaces the first line (bold) with the first line of the description, moves up the second line, displays the large image tooltip.
   */
  Streaming,
  /**
   * Member List: `Listening to **_** 🗎`
   *
   * Profile: 
   * - `LISTENING TO _`
   * - Replaces the first line (bold) with the first line of the description, moves up the second line, displays the large image tooltip.
   */
  Listening,
  /**
   * Member List: `Watching **_** 🗎`
   *
   * Profile:
   * - `WATCHING _`
   * - Replaces the first line (bold) with the first line of the description, moves up the second line, displays the large image tooltip.
   */
  Watching,
  /**
   * Appears to be used internally for Custom Status & Voice Channel activities. Will display the `name`.
   */
  Custom,
  /**
   * Member List: `Competing in **_** 🗎`
   *
   * Profile:
   * - `COMPETING IN _`
   * - Replaces the first line (bold) with the first line of the description, moves up the second line, displays the large image tooltip.
   */
  Competing,
}

export type ActivityImage = {
  url: URL,
  tooltip?: string,
} | {
  /** Static image uploaded to the discord dev panel. */
  key: string,
  tooltip?: string,
};

type ActivityButton = {
  label: string,
  url: URL,
}

export type Activity = {
  /**
   * Display name of the app (does not have to match the discord dev panel).
   */
  name: string,
  /**
   * Optional. Defaults to the primary application id.
   */
  app_id?: string,
  /**
   * Optional. Whether to use "Playing _", "Listening to _", etc. Defaults to `ActivityType.Playing`.
   */
  type?: ActivityType,
  platform?: 'desktop' | 'ios' | 'android',
  description?: string | [string, string],
  images?: {
    large: ActivityImage,
    small?: ActivityImage,
  },
  timestamps?: { // TODO: Make this less dumb to use & do testing with different types
    start: number,
    end?: number
  },
  buttons?: ActivityButton | [ActivityButton, ActivityButton],
};

export type SessionToken = string;
export default class DiscordRPC {
  redirect_handler?: URL

  user_token?: string

  sessions?: Map<SessionToken, Activity[]> = new Map()

  /**
   * @param app_id Discord application to authorize under. Does not have to match the id used in activities.
   */
  constructor(public app_id: string) {}

  /**
   * @param redirect_handler OAuth redirect that will contain the finalization code URL param (Hint: this is your host).
   * @returns OAuth URL to give to the user.
   */
  getAuthLink(redirect_handler: URL) {
    this.redirect_handler = redirect_handler;

    return new URL(`https://discord.com/oauth2/authorize?${new URLSearchParams({
      client_id: this.app_id,
      response_type: 'code',
      scope: 'identify activities.write',
      redirect_uri: `${redirect_handler}`,
    })}`)
  }

  /**
   * @param secret Discord application secret.
   * @param code Finalization code from the redirect.
   */
  async authorize(app_secret: string, code: string) {
    const res = await fetch(`${API}/oauth2/token`, {
      method: 'POST',
      body: new URLSearchParams({
        client_id: this.app_id,
        client_secret: app_secret,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: `${this.redirect_handler}`,
      }),
      headers: {
        "Content-Type": 'application/x-www-form-urlencoded'
      }
    })

    this.user_token = (await res.json()).access_token;
  }

  async setActivity(activity: Activity | Activity[], old_session_token?: SessionToken) {
    const activities = Array.isArray(activity) ? activity : [activity];

    const res = await fetch(`${API}/users/@me/headless-sessions`, {
      method: 'POST',

      body: JSON.stringify({
        ...(old_session_token ? {
          token: old_session_token
        } : {}),

        activities: activities.map(a => ({
          name: a.name,
          application_id: a.app_id || this.app_id,
          type: `${a.type || 0}`,
          platform: a.platform || 'desktop',
          ...(a.description ? {
            state: (typeof a.description === 'string' ? a.description : a.description[0]),
            details: Array.isArray(a.description) ? a.description[1]: '',
          } : {}),
          assets: a.images ? {
            // @ts-ignore TODO: I don't know how to fix this crap
            large_image: a.images.large.key || a.images.large.url,
            large_text: a.images.large.tooltip || '',
  
            ...(a.images.small ? {
              // @ts-ignore
              small_image: a.images.small.key || a.images.small.url,
              small_text: a.images.small.tooltip || '',
            } : {})
          } : undefined,
          timestamps: a.timestamps,
          buttons: a.buttons,
        }))
      }),

      headers: {
        "Authorization": `Bearer ${this.user_token}`,
        "Content-Type": 'application/json',
      },
    });

    let session_token: string

    if (old_session_token) {
      session_token = old_session_token
    } else {
      const json: { token: SessionToken } = (await res.json()) as any;

      const new_session_token = json.token;

      this.sessions.set(new_session_token, activities)

      session_token = new_session_token
    }

    setTimeout(() => {
      if (this.sessions.has(session_token)) this.setActivity(activities, session_token)
    }, 1000*60*30) // Wait 30 minutes to renew

    return session_token
  }

  async clearActivity(session_token: SessionToken) {
    this.sessions.delete(session_token)

    await fetch(`${API}/users/@me/headless-sessions/delete`, {
      method: 'POST',
      body: JSON.stringify({ token: session_token }),
      headers: {
        "Authorization": `Bearer ${this.user_token}`,
        "Content-Type": 'application/json',
      },
    });
  }

  async clearAll() {
    for await (const identifier of this.sessions.keys()) {
      await this.clearActivity(identifier);
    }
  }
}