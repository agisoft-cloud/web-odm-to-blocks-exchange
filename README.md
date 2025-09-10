# WebODM to Bently Blocks Exchange plugin


## About

This is a plugin for the [WebODM](https://github.com/OpenDroneMap/WebODM) photogrammetry software allowing 
to export results of photo triangulation in a Bently Blocks Exchange format. This data can be further imported to Agisoft Metashape Professional or other photogrammetry packages for processing.

## Development

1. Install [WebODM](https://github.com/OpenDroneMap/WebODM?tab=readme-ov-file#manual-installation-docker)
1. Place this repo files into: `//WebODM/coreplugins/plugin-name`
1. Start WebODM in development mode:

```bash
./webodm.sh restart --dev --dev-watch-plugins

```

## Building

Pack the repository content into a .zip archive with the following structure:

```pseudocode
plugin-name.zip
	plugin-name
		public
			main.js
		_init_.py
		manifest.json
		plugin.py
		README.md
```

**NOTE**

WebODM will name your plugin accoriding to the name of the core folder in the archive, so name it appropiatly.

## Installation and testing

1. Start WebODM: `./webodm.sh restart`
1. Navigate to WebODM plugin management page: http://localhost:8000/admin/app/plugin/
1. Click on the *Load plugin (.zip)
1. Select the .zip file with the plugin.
