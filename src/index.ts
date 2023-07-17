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
   * Profile: `LIVE ON TWITCH` (yes)
   * 
   * Changes status from Online to Streaming (Purple icon).
   */
  Streaming,
  /**
   * Member List: `Listening to **_** 🗎`
   * 
   * Profile: `LISTENING TO SPOTIFY` (yes) // TODO: Test
   * 
   * // TODO: Test timestamps
   */
  Listening,
  /**
   * Member List: `Watching **_** 🗎`
   * 
   * Profile: `WATCHING ...` // TODO: Test
   */
  Watching,
  /**
   * Appears to be used internally for Custom Status & Voice Channel activities. Will display the `name`.
   */
  Custom,
  /**
   * Member List: `Competing **_** 🗎` // TODO: Test
   * 
   * Profile: `COMPETING ...` // TODO: Test
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
  platform?: 'desktop' | 'mobile' | 'web',
  description?: string | [string, string],
  images?: {
    large: ActivityImage,
    small?: ActivityImage,
  },
  timestamps?: { // TODO: Make this less dumb to use
    start: number,
    end?: number
  },
  buttons?: ActivityButton | [ActivityButton, ActivityButton],
};

export type ActivityIdentifier = string;
export default class DiscordRPC {
  redirect_handler?: URL

  user_token?: string

  identifiers?: ActivityIdentifier[]

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

    console.log(await res.json());
  }

  async setActivity(activity: Activity | Activity[]) {
    const activities = Array.isArray(activity) ? activity : [activity];

    const res = await fetch(`${API}/users/@me/headless-sessions`, {
      method: 'POST',

      body: JSON.stringify({
        activities: activities.map(a => ({
          name: a.name,
          application_id: a.app_id || this.app_id,
          type: `${a.type}`,
          platform: a.platform || 'desktop',
          state: a.description ? (typeof a.description === 'string' ? a.description : a.description[0]) : '', // TODO: Test if these are needed
          details: a.description && Array.isArray(a.description) ? a.description[1]: '',
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
        "Content-Type": 'application/json'
      }
    })

    const json: { token: ActivityIdentifier } = (await res.json()) as any;

    console.log(json);
  
    const identifier = json.token;

    this.identifiers?.push(identifier);
  
    return identifier;
  }

  async clearActivity(identifier: ActivityIdentifier) {
    await fetch(`${API}/users/@me/headless-sessions/delete`, {
      method: 'POST',
      body: JSON.stringify({ token: identifier }),
      headers: {
        "Authorization": `Bearer ${this.user_token}`,
        "Content-Type": 'application/json',
      },
    });
  }

  async clearAll() {
    if (this.identifiers) {
      for await (const identifier of this.identifiers) {
        await this.clearActivity(identifier);
      } 
    }
  }
}