const ArgumentParser = require('argparse').ArgumentParser;
const { exec } = require('child_process');
const yaml = require('js-yaml');
const fs = require('fs');


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
    [ 'subMapSize' ],
    {
      help: 'subMapSize as an [n, m] array'
    }
  );

  parser.addArgument(
    [ 'output' ],
    {
      help: 'output file path. The fitting tile indecies will be added to it with an .svg ending'
    }
  );

  return parser.parseArgs();
}

function saveSvg(args, newBbox, x, y ){
  cmd = [
    'node map2svg.js',
    args.config_path,
    '-c',
    '\'' + JSON.stringify({"bbox": newBbox}) + '\'',
    '-o',
    '\'' + args.output + '_' + x + 'x' + y + '.svg\''
  ].join(" ")

  //console.log(cmd)

  exec(cmd , (err, stdout, stderr) => {
    if (err) {
      // node couldn't execute the command
      return;
    }
  
    // the *entire* stdout and stderr (buffered)
    //console.log(`stdout: ${stdout}`);
    //console.log(`stderr: ${stderr}`);
  });

}

function getConfig(args){
  config = yaml.safeLoad(fs.readFileSync(args.config_path, 'utf8'))
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
  
  return config;
}

function main(){
  const args = getArgs();

  const config = getConfig(args);  

  
  const [widthCount, heightCount] = JSON.parse(args.subMapSize)

  const width = config.bbox.xMax - config.bbox.xMin;
  const height = config.bbox.yMax - config.bbox.yMin;
  
  const deltaWidth = Math.round(width/widthCount*1000000)/1000000;
  const deltaHeight = Math.round(height/heightCount*1000000)/1000000;
  
  for(let x=0; x<widthCount; x++){
    for(let y=0; y<heightCount; y++){
      newBbox = {
        xMin: config.bbox.xMin + x*deltaWidth,
        yMin: config.bbox.yMin + y*deltaHeight,
        xMax: config.bbox.xMin + (x+1)*deltaWidth,
        yMax: config.bbox.yMin + (y+1)*deltaHeight
      }
      saveSvg(args, newBbox, x+1, y+1)
      
    }
  }

}