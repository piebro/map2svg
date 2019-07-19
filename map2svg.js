const fs = require('fs');
const yaml = require('js-yaml');
var ArgumentParser = require('argparse').ArgumentParser;

main();

function getArgs(){
  var parser = new ArgumentParser({
    version: '0.0.1',
    addHelp:true,
    description: 'Argparse example'
  });
  parser.addArgument(
    [ 'config_path' ],
    {
      help: 'path to a config file'
    }
  );
  parser.addArgument(
    [ '-c', '--config' ],
    {
      help: 'to change configs in json dynamically'
    }
  );

  parser.addArgument(
    [ '-o', '--output' ],
    {
      help: 'path for the output file. Otherwise it will print the svg to the cmd line'
    }
  );

  return parser.parseArgs();
}

function getConfigs(args){
  config = yaml.safeLoad(fs.readFileSync(args.config_path, 'utf8'))

  if(args.config != null){
    cmdLineConfig = JSON.parse(args.config)
    config = Object.assign(config, cmdLineConfig);
  }
  
  return config;
}

async function main(){

  args = getArgs()
  config = getConfigs(args)
  
  bbox = config.bbox;

  if(bbox.xyRatio !== undefined){
    bbox.yLength = bbox.xLength / bbox.xyRatio / config.heightMult
  }

  if(bbox.middle !== undefined && bbox.xLength !== undefined && bbox.yLength !== undefined){
    bbox.xMin = bbox.middle[1]-bbox.xLength/2
    bbox.yMin = bbox.middle[0]-bbox.yLength/2
    bbox.xMax = bbox.middle[1]+bbox.xLength/2
    bbox.yMax = bbox.middle[0]+bbox.yLength/2
  }
  results = await dbRequests(config)
  svgStr = createSVG(config, results)

  if(args.output == null){
    console.log(svgStr)
  } else {
    fs.writeFile(args.output, svgStr, (err) => {
      // throws an error, you could also catch it here
      if (err) throw err;
    }); 
  }
}

async function dbRequests(config){
  const { _ , Client } = require('pg')
  const client = new Client({
    user: 'openmaptiles',
    host: 'localhost',
    database: 'openmaptiles',
    password: 'openmaptiles',
    port: 5432,
  })
  client.connect()

  bboxString = "" + config.bbox.xMin + ", " + config.bbox.yMin + ", " + config.bbox.xMax + ", " + config.bbox.yMax

  results = []

  for(request of config.requests){
    query = buildQueryString(bboxString, request)
    const res = await client.query(query)

    geometry = []
    for(row of res.rows){
      geometry.push(JSON.parse(row.geometry))
    }

    results.push({
      geometry: geometry,
      request: request
    })
  }
  await client.end()
  return results
}

function buildQueryString(bboxString, request){
  queryArray = [
    'SELECT ST_AsGeoJSON(ST_Transform(geometry, 4326)) AS geometry FROM',
    request.table,
    'WHERE geometry && ST_Transform(ST_MakeEnvelope(',
    bboxString,
    ', 4326), 3857)'
  ]

  if(request.restrictions !== undefined && request.restrictions !== ""){
    queryArray.push("AND (" + request.restrictions + ")")
  }

  return queryArray.join(" ") + ";"
}

function createSVG(config, results){
  const window   = require('svgdom')
  const SVG      = require('svg.js')(window)  
  const document = window.document

  bbox = config.bbox

  const svgWidth = config.svgWidth;
  const heightMult = config.heightMult;

  bboxWidth = bbox.xMax-bbox.xMin
  bboxHeight = (bbox.yMax-bbox.yMin)*heightMult
  scaleValue = svgWidth / bboxWidth

  svgHeight = bboxHeight * scaleValue

  const draw = SVG(document.documentElement)
  draw.size(svgWidth,svgHeight)
  draw.rect(200000, 200000).move(-100000,-100000).fill(config["background-color"])

  for(result of results){
    for(geo of result.geometry){
      if(geo.type=="LineString"){
        line = geo.coordinates
        newline = line.map((p)=>[(p[0]-bbox.xMin)*scaleValue,(-p[1]+bbox.yMax)*scaleValue*heightMult])
        draw.polyline(newline).attr(result.request).attr({"stroke-linecap":"round"})
      } else if(geo.type=="Polygon"){
        for(line of geo.coordinates){
          newline = line.map((p)=>[(p[0]-bbox.xMin)*scaleValue,(-p[1]+bbox.yMax)*scaleValue*heightMult])
          draw.polyline(newline).attr(result.request).attr({"stroke-linecap":"round"})
        }
      }
    }
  }

  return draw.svg();
}
