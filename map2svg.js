const fs = require('fs');  


main();

async function main(){
  config = JSON.parse(fs.readFileSync(process.argv[2]))
  results = await dbRequests(config)
  createSVG(config, results)
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


  bboxString = "" + config.bbox[0] + ", " + config.bbox[1] + ", " + config.bbox[2] + ", " + config.bbox[3]


  results = []

  for(request of config.requests){
    query = buildQueryString(bboxString, request)
    //console.error(query)
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

  bboxWidth = bbox[2]-bbox[0]
  bboxHeight = (bbox[3]-bbox[1])*heightMult
  scaleValue = svgWidth / bboxWidth

  svgHeight = bboxHeight * scaleValue

  const draw = SVG(document.documentElement)
  draw.size(svgWidth,svgHeight)
  draw.rect(200000, 200000).move(-100000,-100000).fill(config["background-color"])

  for(result of results){
    for(geo of result.geometry){
      if(geo.type=="LineString"){
        line = geo.coordinates
        newline = line.map((p)=>[(p[0]-bbox[0])*scaleValue,(-p[1]+bbox[3])*scaleValue*heightMult])
        draw.polyline(newline).attr(result.request)
      } else if(geo.type=="Polygon"){
        for(line of geo.coordinates){
          newline = line.map((p)=>[(p[0]-bbox[0])*scaleValue,(-p[1]+bbox[3])*scaleValue*heightMult])
          draw.polyline(newline).attr(result.request)
        }
      }
    }
  }

  console.log(draw.svg())
}
