import DiscordRPC, { getUserToken } from ".";

(async () => {
  const RPC = new DiscordRPC(await getUserToken('', '')) // TODO

  await RPC.setActivity({
    name: 'DRPC OAuth',
    application_id: '757025177061294194',
  });
})()