/*
  A simple Orbit bot that listens on a channel and caches all messages.

  Usage:
  node index.js <botname> <channel>

  Eg.
  node index.js Cacher1 ipfs
*/

'use strict'

const IpfsDaemon = require('ipfs-daemon')
const Orbit = require('orbit_')

// Options
let user = process.argv[2] || 'OrbitBot'
let channel = process.argv[3] || 'ipfs'

// State
let orbit, ipfs

// MAIN
const dataDir = './cache/' + user
const ipfsDataDir = dataDir + '/ipfs'

function formatTimestamp(timestamp) {
  const safeTime = (time) => ("0" + time).slice(-2)
  const date = new Date(timestamp)
  return safeTime(date.getHours()) + ":" + safeTime(date.getMinutes()) + ":" + safeTime(date.getSeconds())
}

// Start an IPFS daemon
IpfsDaemon({ IpfsDataDir: ipfsDataDir })
  .then((daemon) => {
    const options = {
      cacheFile: dataDir + '/orbit.cache',
      maxHistory: 10, 
      keystorePath: dataDir + '/keys'
    }

    orbit = new Orbit(daemon.ipfs, options)
    
    // Handle new messages
    orbit.events.on('message', (channel, message) => {
      // Get the actual content of the message
      orbit.getPost(message.payload.value, true)
        .then((post) => {
          console.log(`${formatTimestamp(post.meta.ts)} < ${post.meta.from.name}> ${post.content}`)
        })
    })

    return
  })
  .then(() => {
    // Connect to the network
    return orbit.connect(user)
  })
  .then(() => {
    console.log(`-!- Connected to ${orbit.network.name}`)
    return orbit.join(channel)
  })
  .then(() => {
    console.log(`-!- Joined #${channel}`)    

    // Get the channel's database and wait for the history to be loaded
    const feed = orbit.channels[channel].feed
    feed.events.on('ready', (name) => {
      // Get last 10 messages from the database
      const oldMessages = feed.iterator({ limit: 10 }).collect()
      // Get the content for each message
      Promise.all(oldMessages.map((e) => orbit.getPost(e.payload.value, true)))
        .then((posts) => {
          console.log("--- History ---")
          posts.forEach((post) => console.log(`${formatTimestamp(post.meta.ts)} < ${post.meta.from.name}> ${post.content}`))
          console.log("--- End of History ---")
          // Send a new message to the channel
          orbit.send(channel, "/me is now caching this channel")
        })
    })

    return
  })
  .catch((e) => {
    console.log(e)
    process.exit(1)
  })
