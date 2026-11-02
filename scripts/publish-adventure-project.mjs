// Valida tudo antes de modificar os arquivos publicados. Use --check para só verificar.
import {readFile,writeFile,access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {validateContent} from '../js/content-data.mjs';
const root=new URL('../',import.meta.url),args=process.argv.slice(2),file=args.find(v=>!v.startsWith('--'));
try{
  if(!file)throw Error('Uso: node scripts/publish-adventure-project.mjs /caminho/adventure-project.json [--check]');
  const read=async url=>JSON.parse(await readFile(url,'utf8'));
  const [input,monsters,manifest]=await Promise.all([read(file),read(new URL('assets/monsters/manifest.json',root)),read(new URL('assets/npcs/manifest.json',root))]);
  const project=validateContent(input,monsters.species);
  for(const n of project.npcs)await access(new URL('assets/npcs/'+n.model,root));
  if(!args.includes('--check')){
    const outputs={...Object.fromEntries(Object.entries({items:'items',quests:'quests',drops:'drops',services:'npc-services'}).map(([key,name])=>[`assets/content/${name}.json`,project[key]])),
      'assets/npcs/manifest.json':{...manifest,npcs:project.npcs}};
    for(const [path,value] of Object.entries(outputs))await writeFile(new URL(path,root),JSON.stringify(value,null,2)+'\n');
  }
  console.log(`${args.includes('--check')?'Validado':'Arquivos atualizados'}: ${project.npcs.length} NPCs, ${project.quests.length} missões, ${project.items.length} itens. Repositório: ${fileURLToPath(root)}`);
}catch(error){console.error(error.message);process.exitCode=1;}
