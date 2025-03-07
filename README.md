# IL-2 Mission Planner Revived

Welcome to the IL2 Mission Planner Revived repository. This repository houses the code behind the [IL2 Mission Planner Revived](https://serverror.github.io/IL2-Mission-Planner/) web based tool, a simple client-side javascript application based primarily on [Leaflet](http://leafletjs.com/).

Unlike the abandoned il2missionplanner.com project, this fork aims to make optional the dependency on the Streaming and API servers (the latter of which only loses automatic JSON fetch functionality) and generally streamline installation for Github Pages and locally hosted setups based on my own working configuration. Streaming (AKA live plan sharing) can optionally be enabled but requires the use of redis and webdis as a backend.

## New in 3.0

Setup has been simplified and relies entirely on npm now. The project has moved towards ES module standards in part to prepare for Leaflet 2.0. Depedencies have been updated and cleaned up and Leaflet is now 1.9.4.

## Issues and Enhancements

If you'd like to report a bug or request an enhancement, please [open an issue](https://github.com/ServError/il2missionplanner.com/issues).

## Contributing

Interested in contributing to this tool? Feel free to fork the project and open a PR when you're ready to contribute back. The code is under the MIT license, so you can basically do whatever you like with it.

## Setting up

Clone the repository. In the repository directory, run `npm ci` to fetch dependencies. Edit conf/conf.json to match your desired setup. I recommend starting with the defaults (streaming false and api set to NONE) and just substituting in your domain name. Run `npm run dist` to generate the files to push to your web server and optionally run `npm run tiles` to fetch the tiles from the 'dist' folder of [the tiles repo](https://github.com/ServError/tiles.il2missionplanner.com) and drop them into the tiles subdirectory of the output. Tiles only need to be fetched once.

## Live Development

Run `npm run develop` and navigate to the dist index file in a web browser (e.g. `file:///path/to/dist/index.html`) to access the site. Beware, this action wipes the dist folder.

### Updating
Simply run `npm run dist` again after a `git pull` and merge the updated output files with your webroot. If moving up a major version (ex. v1 to v2), repeat the 'Setting up' process instead.

### Streaming

Use your package manager to download redis and webdis. Head to [the stream repo](https://github.com/ServError/stream.il2missionplanner.com) and grab the load_scripts.sh and contents of the lua folder. Nothing else in that repo is especially necessary, and I believe the stock redis and webdis configs are fine for our purposes. Make sure redis and webdis are configured to start on boot and check for failures (I needed a delay after the redis start or webdis complained) then edit the webdis service file to execute the load_scripts.sh script as a POSTEXEC and make sure it can see the lua files.

Now configure your web host of choice to reverse proxy the webdis commands on their port. I sent them to a WEBDIS subfolder for ease of integration with the map server.

### API Server

You're mostly on your own here. It's not too hard to get the docker running, and after that you'd need to direct traffic between it and your map server. You may need to tweak your dockerhub images to something more recent or compatible with your server's architecture. I personally found it not worth it for the minimal functionality, and may reimplement it in a different way down the road.
