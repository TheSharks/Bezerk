<p align="center">
    <img src="http://i.imgur.com/ChKIOlj.png">
    <a href="https://discord.gg/0cFoiR5QVh5LZlQO"><img src="https://discordapp.com/api/guilds/110462143152803840/widget.png" alt="Discord server"></a>
</p>

---

Bezerk is a websocket-based server designed to remotely manage [WildBeast](https://github.com/TheSharks/WildBeast) instances by sending JavaScript instructions.   

# Deployment
Bezerk requires 2 environment variables to be present, namely `BEZERK_PORT`, and `BEZERK_SECRET`, please note that this program will output little to no console output.   
`BEZERK_PORT` defines the port where the server should listen on, `BEZERK_SECRET` is a shared secret between listeners and WildBeast shards used for simple identification.   
**It's important to choose a strong secret and keep it secure!**

# Warnings
Bezerk handles sensitive data and should be kept as secure as possible, malicious connections to Bezerk could result in arbitrary code execution in the context of your WildBeast shards.
