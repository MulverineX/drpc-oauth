import "dotenv/config";

const API = "https://discord.com/api/v10";

// TODO
export async function getUserToken(code, redirect: string) {
  const res = await fetch(`${API}/oauth2/token`, {
    method: "POST",
    body: new URLSearchParams({
      client_id: process.env.CLIENT_ID as string,
      client_secret: process.env.CLIENT_SECRET as string,
      grant_type: "authorization_code",
      code: code,
      redirect_uri: redirect,
    }),
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    }
  })

  const json = await res.json();

  console.log(json);
}

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
  application_id: string,
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
  identifiers: ActivityIdentifier[]

  constructor(public user_token: string) {
    // Running in node
    if (typeof window === 'undefined') {
      async function exitHandler() {
        await this.clearAll();
        process.exit();
      }
      
      process.on('SIGINT', exitHandler);
      process.on('SIGUSR1', exitHandler);
      process.on('SIGUSR2', exitHandler);
      
      process.on('uncaughtException', exitHandler);
      
      setInterval(() => { }, 0x7FFFFFFF) // stop node from exiting
    }
  }

  async setActivity(activity: Activity | Activity[]) {
    const activities = Array.isArray(activity) ? activity : [activity];

    const res = await fetch(`${API}/users/@me/headless-sessions`, {
      method: 'POST',

      body: JSON.stringify({
        activities: activities.map(a => ({
          name: a.name,
          application_id: a.application_id,
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
        "Content-Type": "application/json"
      }
    })
  
    console.log(await res.clone().text());
  
    const identifier: ActivityIdentifier = (await res.json()).token;

    this.identifiers.push(identifier)
  
    return identifier;
  }

  async clearActivity(identifier: ActivityIdentifier) {
    const res = await fetch(`${API}/users/@me/headless-sessions/delete`, {
      method: "POST",
      body: JSON.stringify({ token: identifier }),
      headers: {
        "Authorization": `Bearer ${this.user_token}`,
        "Content-Type": "application/json",
      },
    })
  
    console.log(await res.text());
  }

  async clearAll() {
    for await (const identifier of this.identifiers) {
      await this.clearActivity(identifier);
    }
  }
}