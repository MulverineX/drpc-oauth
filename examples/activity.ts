import DiscordRPC from '../src/index';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

(async () => {
  const RPC = new DiscordRPC(process.env.CLIENT_ID as string)

  if (typeof process.env.OAUTH_TOKEN === 'string') {

    await RPC.authorize(process.env.CLIENT_SECRET as string, process.env.OAUTH_TOKEN);

    const activity = await RPC.setActivity({
      name: 'DRPC OAuth',
      description: [
        'Vibing',
        'Got this awesome test of Discord\'s sick REST API for RPC'
      ],
      images: {
        large: {
          url: new URL('https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png'),
        },
      },
    });

    async function exitHandler() {
      await RPC.clearAll();
      process.exit();
    }

    process.on('SIGINT', exitHandler);
    process.on('SIGUSR1', exitHandler);
    process.on('SIGUSR2', exitHandler);
    process.on('uncaughtException', exitHandler);
  
    await sleep(1000*60*2); // wait 2 minutes

    // await RPC.clearActivity(activity)

    await RPC.clearAll();
  } else {
    console.log(`Please authorize and add code to environment. ${RPC.getAuthLink(new URL('http://activity_test.local/auth'))}`);
  }
})()