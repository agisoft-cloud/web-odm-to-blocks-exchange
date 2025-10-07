# WebODM to Bently Blocks Exchange plugin


## About

This plugin for [WebODM](https://github.com/OpenDroneMap/WebODM) enables the export of photo triangulation results in the [Bentley BlocksExchange](https://docs.bentley.com/LiveContent/web/ContextCapture%20Help-v18/en/GUID-59E6CC36-F349-4DE0-A563-FFC47296A624.html) format. The exported data can then be imported into third-party photogrammetry software for further processing.


## Limitations

### Equirectangular cameras

BlocksExchange does not support equirectangular cameras; therefore, exporting a dataset that includes equirectangular imagery will result in an error.

### Mulitspectral datasets

WebODM does not provide calibration parameters for all sensors in multispectral datasets (e.g., MicaSense cameras). Instead, it only includes calibration data for the primary band images. As a result, exporting photo triangulation parameters from a multispectral dataset will likely lead to incomplete or incorrect imports in third-party software.

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

WebODM names the plugin accoriding to the name of the core folder in the archive, so name it appropiatly.

## Installation and testing

1. Start WebODM: `./webodm.sh restart`
1. Navigate to WebODM plugin management page: http://localhost:8000/admin/app/plugin/
1. Click on the *Load plugin (.zip)
1. Select the .zip file with the plugin.
