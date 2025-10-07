PluginsAPI.Dashboard.addTaskActionButton(function (options) {
    return React.createElement(
        "div", { className: "btn-group" },
        React.createElement(
            "button", {
                className: "btn btn-sm btn-primary",
                onClick: async function () {
                    const taskId = options.task.id;
                    const projectId = options.task.project;
                    const base = `/api/projects/${projectId}/tasks/${taskId}`;

                    // OpenSfM : https://opensfm.readthedocs.io/en/latest/dataset.html#reconstruction-file-format
                    // BlocksExchange: https://docs.bentley.com/LiveContent/web/ContextCapture%20Help-v17/en/GUID-59E6CC36-F349-4DE0-A563-FFC47296A624.html
                    const cameraModelMap = [
                        { opensfm: "perspective", blocksexchange: "Perspective" },
                        { opensfm: "brown", blocksexchange: "Perspective" },
                        { opensfm: "fisheye", blocksexchange: "Fisheye" },
                        { opensfm: "fisheye_opencv", blocksexchange: "Fisheye" },
                        { opensfm: "equirectangular", blocksexchange: "Spherical" }
                    ];

                    try {
                        const [taskRes, shotsRes, cameraRes] = await Promise.all([
                            fetch(`${base}/?format=json`),
                            fetch(`${base}/download/shots.geojson`),
                            fetch(`${base}/download/cameras.json`)
                        ]);

                        if (!taskRes.ok) throw new Error("Failed to fetch task JSON");
                        if (!shotsRes.ok) throw new Error("Failed to fetch shots");
                        if (!cameraRes.ok) throw new Error("Failed to fetch cameras");

                        const task = await taskRes.json();
                        const shots = await shotsRes.json();
                        const cameras = await cameraRes.json();

                        if (!shots.features || shots.features.length === 0) {
                            throw new Error("No shots found in task.");
                        }

                        function mapCameraModel(openSfmModel) {
                            const defaultModel = "Perspective"
                            const entry = cameraModelMap.find(m => m.opensfm === openSfmModel);
                            return entry ? entry.blocksexchange : defaultModel;
                        }

                        function rotationVectorToMatrix([rx, ry, rz]) {
                            const theta = Math.hypot(rx, ry, rz);
                            if (theta === 0) return [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
                            const x = rx / theta, y = ry / theta, z = rz / theta;
                            const cosT = Math.cos(theta);
                            const sinT = Math.sin(theta);
                            const oneMinusCosT = 1 - cosT;
                            return [
                                [
                                    cosT + x * x * oneMinusCosT,
                                    x * y * oneMinusCosT - z * sinT,
                                    x * z * oneMinusCosT + y * sinT
                                ],
                                [
                                    y * x * oneMinusCosT + z * sinT,
                                    cosT + y * y * oneMinusCosT,
                                    y * z * oneMinusCosT - x * sinT
                                ],
                                [
                                    z * x * oneMinusCosT - y * sinT,
                                    z * y * oneMinusCosT + x * sinT,
                                    cosT + z * z * oneMinusCosT
                                ]
                            ];
                        }

                        function getUTMZoneFromExtent(extent) {
                            const [minLon, minLat, maxLon, maxLat] = extent;
                            const medianLon = (minLon + maxLon) / 2;
                            const medianLat = (minLat + maxLat) / 2;
                            const zone = Math.floor((medianLon + 180) / 6) + 1;
                            const hemisphere = medianLat >= 0 ? "N" : "S";
                            return `WGS 84 UTM Zone ${zone}${hemisphere}`;
                        }

                        const crsName = getUTMZoneFromExtent(task.extent);
                        const crsAuthority = task.epsg;

                        function convertToBEX(shots, cameras, taskId) {
                            const indent = (level) => "  ".repeat(level);
                            let xml = `<?xml version="1.0" encoding="utf-8"?>\n`;
                            xml += `<BlocksExchange version="2.1">\n`;

                            xml += `${indent(1)}<SpatialReferenceSystems>\n`;
                            xml += `${indent(2)}<SRS>\n`;
                            xml += `${indent(3)}<Id>0</Id>\n`;
                            xml += `${indent(3)}<Name>${crsName}</Name>\n`;
                            xml += `${indent(3)}<Definition>EPSG:${crsAuthority}</Definition>\n`;
                            xml += `${indent(2)}</SRS>\n`;
                            xml += `${indent(1)}</SpatialReferenceSystems>\n`;

                            xml += `${indent(1)}<Block>\n`;
                            xml += `${indent(2)}<Name>Task ${taskId}</Name>\n`;
                            xml += `${indent(2)}<Description>Aerotriangulation results</Description>\n`;
                            xml += `${indent(2)}<SRSId>0</SRSId>\n`;

                            xml += `${indent(2)}<Photogroups>\n`;

                            // Group shots by camera
                            const shotsByCamera = {};
                            shots.features.forEach(shot => {
                                const cameraKey = shot.properties.camera;
                                if (!shotsByCamera[cameraKey]) {
                                    shotsByCamera[cameraKey] = [];
                                }
                                shotsByCamera[cameraKey].push(shot);
                            });

                            // Create a photogroup for each camera
                            let photoIdCounter = 1;
                            Object.entries(shotsByCamera).forEach(([cameraKey, cameraShots]) => {
                                let camModel = cameras[cameraKey];
                                if (!camModel) {
                                    const firstCamKey = Object.keys(cameras)[0];
                                    camModel = cameras[firstCamKey];
                                    console.warn(`Camera key '${cameraKey}' not found, using first camera: '${firstCamKey}'`);
                                }

                                const firstShot = cameraShots[0].properties;
                                
                                const pixel_cx = (camModel.c_x + 0.5) * firstShot.width;
                                const pixel_cy = (camModel.c_y + 0.5) * firstShot.height;
                                const pixel_focal_x = camModel.focal_x * firstShot.width;
                                const pixel_focal_y = camModel.focal_y * firstShot.height;
                                
                                const isFisheye = camModel.projection_type === 'fisheye' || 
                                                  camModel.projection_type === 'fisheye_opencv';

                                xml += `${indent(3)}<Photogroup>\n`;
                                xml += `${indent(4)}<Name>${cameraKey}</Name>\n`;
                                xml += `${indent(4)}<ImageDimensions><Width>${firstShot.width}</Width><Height>${firstShot.height}</Height></ImageDimensions>\n`;
                                xml += `${indent(4)}<CameraModelType>${mapCameraModel(camModel.projection_type)}</CameraModelType>\n`;
                                xml += `${indent(4)}<CameraModelBand>Visible</CameraModelBand>\n`;
                                xml += `${indent(4)}<PrincipalPoint><x>${pixel_cx}</x><y>${pixel_cy}</y></PrincipalPoint>\n`;
                                
                                // Fisheye cameras use focal matrix, others use single focal length
                                if (isFisheye) {
                                    // BlocksExchange uses π/2 scaling for fisheye focal length
                                    // https://docs.bentley.com/LiveContent/web/ContextCapture%20Help-v18/en/GUID-2C3D344E-AC94-4928-8E3A-E85025EDDF1D.html
                                    const fisheye_fx = pixel_focal_x * Math.PI / 2;
                                    const fisheye_fy = pixel_focal_y * Math.PI / 2;
                                    xml += `${indent(4)}<FisheyeFocalMatrix>\n`;
                                    xml += `${indent(5)}<M_00>${fisheye_fx}</M_00>\n`;
                                    xml += `${indent(5)}<M_01>0</M_01>\n`;
                                    xml += `${indent(5)}<M_10>0</M_10>\n`;
                                    xml += `${indent(5)}<M_11>${fisheye_fy}</M_11>\n`;
                                    xml += `${indent(4)}</FisheyeFocalMatrix>\n`;
                                } else {
                                    xml += `${indent(4)}<FocalLengthPixels>${pixel_focal_x}</FocalLengthPixels>\n`;
                                }

                                // P coefficients are reversed in OpenSfm comparing to BlocksExchange, see:
                                // https://opensfm.org/docs/geometry.html?highlight=brown#brown-camera
                                // https://docs.bentley.com/LiveContent/web/ContextCapture%20Help-v18/en/GUID-2D452A8A-A4FE-450D-A0CA-9336DCF1238A.html
                                xml += `${indent(4)}<Distortion>\n`;
                                xml += `${indent(5)}<K1>${camModel.k1}</K1>\n`;
                                xml += `${indent(5)}<K2>${camModel.k2}</K2>\n`;
                                xml += `${indent(5)}<P1>${camModel.p2}</P1>\n`;
                                xml += `${indent(5)}<P2>${camModel.p1}</P2>\n`;
                                xml += `${indent(5)}<K3>${camModel.k3}</K3>\n`;
                                xml += `${indent(4)}</Distortion>\n`;

                                // Add all photos for this camera
                                cameraShots.forEach((shot) => {
                                    const props = shot.properties;
                                    const matrix = rotationVectorToMatrix(props.rotation);

                                    xml += `${indent(4)}<Photo>\n`;
                                    xml += `${indent(5)}<Id>${photoIdCounter++}</Id>\n`;
                                    xml += `${indent(5)}<ImagePath>${props.filename}</ImagePath>\n`;
                                    xml += `${indent(5)}<Pose>\n`;

                                    xml += `${indent(6)}<Rotation>\n`;
                                    for (let r = 0; r < 3; r++) {
                                        for (let c = 0; c < 3; c++) {
                                            xml += `${indent(7)}<M_${r}${c}>${matrix[r][c]}</M_${r}${c}>\n`;
                                        }
                                    }
                                    xml += `${indent(6)}</Rotation>\n`;

                                    xml += `${indent(6)}<Center>\n`;
                                    xml += `${indent(7)}<x>${props.translation[0]}</x>\n`;
                                    xml += `${indent(7)}<y>${props.translation[1]}</y>\n`;
                                    xml += `${indent(7)}<z>${props.translation[2]}</z>\n`;
                                    xml += `${indent(6)}</Center>\n`;

                                    xml += `${indent(5)}</Pose>\n`;
                                    xml += `${indent(4)}</Photo>\n`;
                                });

                                xml += `${indent(3)}</Photogroup>\n`;
                            });

                            xml += `${indent(2)}</Photogroups>\n`;
                            xml += `${indent(1)}</Block>\n`;
                            xml += `</BlocksExchange>\n`;

                            return xml;
                        }

                        const bloxfContent = convertToBEX(shots, cameras, taskId);

                        const blob = new Blob([bloxfContent], { type: "application/octet-stream" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `task-${taskId}.xml`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        setTimeout(() => URL.revokeObjectURL(url), 100);
                    } catch (err) {
                        alert("Error exporting BlocksExchange: " + err.message);
                    }
                },
            },
            "Export Blocks Exchange"
        )
    );
});