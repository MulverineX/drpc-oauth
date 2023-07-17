import * as http from 'http'
import { config } from 'dotenv'

import DiscordRPC, { ActivityType } from '../src/index';

/**
 * .env
 * 
 * CLIENT_ID=<discord app id>
 * CLIENT_SECRET=<discord app secret>
 */
config()

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

(async () => {
  const RPC = new DiscordRPC(process.env.CLIENT_ID);

  const auth_link = RPC.getAuthLink(new URL('http://localhost:8080/callback'));

  console.log(`Please begin authorization. ${auth_link}`);

  const auth_code: string = await new Promise((resolve) => {
    http.createServer((request, response) => {
      response.writeHead(200);
      response.end();

      resolve(request.url.split('?code=')[1])
    }).listen('8080')
  })

  console.log('> Authorization started.')

  await RPC.authorize(process.env.CLIENT_SECRET, auth_code);

  console.log('> Authorization successful.')

  const activity = await RPC.setActivity({
    type: ActivityType.Playing,
    name: 'DRPC OAuth',
    description: [
      'Vibing',
      'Got this awesome test of Discord\'s sick REST API for RPC.'
    ],
    images: {
      large: {
        url: new URL('https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png'),
        tooltip: 'Published on GitHub',
      },
      small: {
        url: new URL('https://cdn.icon-icons.com/icons2/2620/PNG/512/among_us_player_red_icon_156942.png'),
        tooltip: 'sus',
      },
    },
    buttons: [
      {
        label: 'Do the thing',
        url: new URL('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
      },
      {
        label: 'No the other thing',
        url: new URL('https://www.youtube.com/watch?v=grd-K33tOSM'),
      },
    ],
  });

  console.log('> Activity sent, 30 seconds until clear.')

  await sleep(1000*30); // wait 30 seconds

  // await RPC.clearActivity(activity)

  await RPC.clearAll();

  console.log('> Activity cleared.')

  process.exit()
})()