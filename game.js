'use strict';
(() => {
  const SIZE = 8;
  const TYPES = [
    {glyph:'ᚠ', color:'#ffbf71', name:'Огън'},
    {glyph:'ᚹ', color:'#6fdfff', name:'Вода'},
    {glyph:'ᛉ', color:'#97ed99', name:'Природа'},
    {glyph:'ᛟ', color:'#dba5ff', name:'Етер'},
    {glyph:'ᛋ', color:'#fff08f', name:'Светлина'},
    {glyph:'ᛏ', color:'#ff8ea8', name:'Дух'}
  ];
  const CHAPTERS = ['Залата на искрите','Забравената крипта','Кристалната бездна','Градината на сенките','Подземното светилище','Портите на ефира','Обсерваторията','Дворецът на бурите','Звездният лабиринт','Сърцето на руните'];
  const STORE = 'rune-labyrinth-save-v2';
  const $ = id => document.getElementById(id);
  const random = n => Math.floor(Math.random()*n);
  const delay = ms => new Promise(resolve => setTimeout(resolve,ms));
  let save = { level:1,total:0,cycles:0,sound:true };
  try {const value = JSON.parse(localStorage.getItem(STORE)); if(value && typeof value==='object') save = {...save,...value};} catch (_) {}
  save.level = Math.min(100,Math.max(1,Number(save.level)||1));
  save.total = Math.max(0,Number(save.total)||0);
  save.cycles = Math.max(0,Number(save.cycles)||0);
  let board=[], selected=null, busy=false, levelScore=0, moves=0, goals={}, counts={}, hints=3, shuffles=2, modalAction=null, pointerStart=null, toastTimer=null, audio=null, generation=0;
  function persist(){ try {localStorage.setItem(STORE,JSON.stringify(save));}catch(_){} }
  function tone(freq=440,duration=.09,type='sine'){
    if(!save.sound)return;
    try {const Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx)return;audio??=new Ctx();if(audio.state==='suspended')audio.resume();const osc=audio.createOscillator(),gain=audio.createGain();osc.type=type;osc.frequency.value=freq;gain.gain.setValueAtTime(.045,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);osc.connect(gain).connect(audio.destination);osc.start();osc.stop(audio.currentTime+duration);}catch(_){}
  }
  function neighbors(a,b){return Math.abs(Math.floor(a/SIZE)-Math.floor(b/SIZE))+Math.abs(a%SIZE-b%SIZE)===1;}
  function swap(arr,a,b){[arr[a],arr[b]]=[arr[b],arr[a]];}
  function getMatches(arr){
    const matches=new Set(), groups=[];
    for(let axis=0;axis<2;axis++)for(let line=0;line<SIZE;line++){
      let run=[],previous=null;
      function commit(){if(run.length>=3){groups.push([...run]);run.forEach(x=>matches.add(x));}}
      for(let step=0;step<=SIZE;step++){
        const i=step===SIZE?-1:(axis===0?line*SIZE+step:step*SIZE+line);
        const val=i<0?null:arr[i];
        if(val!==null && val!==-1 && val===previous){run.push(i);}else{commit();run=val===null||val===-1?[]:[i];previous=val;}
      }
    }
    return {matches,groups};
  }
  function findMove(arr){
    for(let i=0;i<arr.length;i++){
      if(arr[i]===-1||arr[i]===null)continue;
      for(const j of [i+1,i+SIZE]){
        if(j>=arr.length||!neighbors(i,j)||arr[j]===-1||arr[j]===null||arr[i]===arr[j])continue;
        swap(arr,i,j);const possible=getMatches(arr).matches.size>=3;swap(arr,i,j);
        if(possible)return [i,j];
      }
    }
    return null;
  }
  function createWalls(level){
    const walls=new Set();const chapter=Math.floor((level-1)/10);
    const target=Math.min(10,2+chapter);
    // Keep most walls away from the center so there are wide lanes for combinations.
    const candidates=[];
    for(let row=1;row<7;row++)for(let col=1;col<7;col++){
      if((row+col)%3===chapter%3 && !(row>=2&&row<=5&&col>=2&&col<=5))candidates.push(row*SIZE+col);
    }
    for(let i=candidates.length-1;i>0;i--){const j=random(i+1);swap(candidates,i,j);}
    for(const index of candidates.slice(0,target))walls.add(index);
    return walls;
  }
  function populate(walls){
    for(let attempt=0;attempt<200;attempt++){
      const next=Array(SIZE*SIZE).fill(null);
      for(let i=0;i<next.length;i++){
        if(walls.has(i)){next[i]=-1;continue;}
        const variants=[0,1,2,3,4,5].filter(v=>{
          const col=i%SIZE,row=Math.floor(i/SIZE);
          return !(col>=2 && next[i-1]===v && next[i-2]===v) && !(row>=2 && next[i-SIZE]===v && next[i-2*SIZE]===v);
        });
        next[i]=variants[random(variants.length)];
      }
      if(findMove(next))return next;
    }
    // Safe fallback: fewer obstacles and another generated board.
    if(walls.size){const reduced=new Set([...walls].slice(0,Math.floor(walls.size/2)));return populate(reduced);}
    throw Error('Невъзможно генериране на ниво');
  }
  function configureLevel(){
    generation++;
    const level=save.level, chapter=Math.floor((level-1)/10);
    const walls=createWalls(level);
    board=populate(walls); selected=null;busy=false;levelScore=0;
    moves=23+Math.min(8,Math.floor((level-1)/15));
    const first=(chapter*2)%TYPES.length,second=(first+2+(level%2))%TYPES.length;
    const count=12+Math.floor((level-1)/5);
    goals={[first]:count,[second]:count};counts={[first]:0,[second]:0};
    hints=3;shuffles=2;
    $('chapterTitle').textContent=CHAPTERS[chapter];$('chapterPill').textContent=`СВЯТ ${chapter+1} / 10`;
    $('missionText').textContent='Събери указаните руни преди да изчерпиш ходовете.';
    $('levelProgress').style.width=`${level}%`;
    hideModal();render();
  }
  function render(){
    $('levelValue').textContent=save.level;$('scoreValue').textContent=levelScore.toLocaleString('bg-BG');$('movesValue').textContent=moves;
    $('totalScore').textContent=save.total.toLocaleString('bg-BG');$('cycles').textContent=save.cycles;
    $('hintCount').textContent=hints;$('shuffleCount').textContent=shuffles;
    $('hintBtn').disabled=busy||hints<=0;$('shuffleBtn').disabled=busy||shuffles<=0;
    $('goals').replaceChildren();
    for(const [id,need] of Object.entries(goals)){
      const item=document.createElement('div');item.className='goal'+(counts[id]>=need?' done':'');
      const left=document.createElement('span');left.className='goal-left';
      const symbol=document.createElement('span');symbol.className='rune-mini';symbol.style.color=TYPES[id].color;symbol.textContent=TYPES[id].glyph;
      left.append(symbol,document.createTextNode(TYPES[id].name));
      const current=document.createElement('strong');current.textContent=`${Math.min(counts[id],need)} / ${need}`;
      item.append(left,current);$('goals').append(item);
    }
    const fragment=document.createDocumentFragment();
    for(let i=0;i<board.length;i++){
      const button=document.createElement('button');button.type='button';button.className='cell '+(board[i]===-1?'wall':'rune')+(selected===i?' selected':'');
      button.dataset.index=String(i);button.setAttribute('role','gridcell');
      if(board[i]===-1){button.disabled=true;button.setAttribute('aria-label','Каменна стена');}
      else if(board[i]!==null){const span=document.createElement('span');span.className='glyph';span.style.color=TYPES[board[i]].color;span.textContent=TYPES[board[i]].glyph;button.append(span);button.setAttribute('aria-label',`Ред ${Math.floor(i/SIZE)+1}, колона ${i%SIZE+1}: ${TYPES[board[i]].name}`);}
      else{button.disabled=true;}
      button.addEventListener('click',()=>pick(i));fragment.append(button);
    }
    $('board').replaceChildren(fragment);
  }
  function notice(message){const el=$('toast');el.textContent=message;el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),1750);}
  function mark(indices,css){for(const i of indices){const cell=$('board').children[i];if(cell)cell.classList.add(css);}}
  function pick(i){
    if(busy||board[i]===-1||board[i]===null)return;
    if(selected===null){selected=i;render();tone(400,.05);return;}
    if(selected===i){selected=null;render();return;}
    if(!neighbors(selected,i)){selected=i;render();tone(400,.05);return;}
    const previous=selected;selected=null;void doSwap(previous,i);
  }
  async function doSwap(a,b){
    busy=true;swap(board,a,b);render();tone(520,.09);
    const turn=generation;
    await delay(150);if(turn!==generation)return;
    if(getMatches(board).matches.size===0){swap(board,a,b);render();mark([a,b],'swap-error');tone(180,.15,'triangle');busy=false;render();return;}
    moves--;await resolveMatches(turn);if(turn!==generation)return;
    if(Object.keys(goals).every(id=>counts[id]>=goals[id])){levelWin();return;}
    if(moves<=0){levelLoss();return;}
    await ensureMove(turn);if(turn!==generation)return;
    busy=false;render();
  }
  async function resolveMatches(turn){
    let cascade=0;
    while(turn===generation && cascade<30){
      const {matches,groups}=getMatches(board);
      if(!matches.size)break;
      cascade++;
      const destroyed=new Set(matches);
      for(const group of groups){
        if(group.length>=5){const center=group[Math.floor(group.length/2)];const row=Math.floor(center/SIZE),col=center%SIZE;
          for(let j=0;j<SIZE;j++){const a=row*SIZE+j,b=j*SIZE+col;if(board[a]!==-1)destroyed.add(a);if(board[b]!==-1)destroyed.add(b);}
        }else if(group.length>=4){
          const center=group[Math.floor(group.length/2)];for(const k of [center-1,center+1,center-SIZE,center+SIZE])if(k>=0&&k<64&&neighbors(center,k)&&board[k]!==-1)destroyed.add(k);
        }
      }
      let collected=0;
      for(const i of destroyed){if(board[i]===null||board[i]===-1)continue;const type=board[i];if(Object.prototype.hasOwnProperty.call(counts,type))counts[type]++;collected++;}
      const earned=collected*60*cascade+Math.max(0,groups.length-1)*100;
      levelScore+=earned;save.total+=earned;persist();
      mark([...destroyed],'burst');tone(490+Math.min(600,cascade*115),.12);
      notice(cascade>1?`КОМБО ×${cascade} · +${earned} точки`:`+${earned} точки`);
      render();mark([...destroyed],'burst');await delay(280);if(turn!==generation)return;
      for(const i of destroyed)if(board[i]!==-1)board[i]=null;
      // Gravity works independently in each vertical segment separated by walls.
      for(let col=0;col<SIZE;col++){
        let bottom=SIZE-1;
        while(bottom>=0){
          if(board[bottom*SIZE+col]===-1){bottom--;continue;}
          let top=bottom;while(top>=0&&board[top*SIZE+col]!==-1)top--;
          const existing=[];for(let row=bottom;row>top;row--)if(board[row*SIZE+col]!==null)existing.push(board[row*SIZE+col]);
          for(let row=bottom;row>top;row--)board[row*SIZE+col]=row>bottom-existing.length?existing[bottom-row]:random(TYPES.length);
          bottom=top-1;
        }
      }
      render();await delay(200);
    }
  }
  async function ensureMove(turn){
    if(findMove(board))return;
    notice('Няма ходове — руните се пренареждат!');
    await delay(350);if(turn!==generation)return;
    board=populate(new Set(board.map((v,i)=>v===-1?i:-1).filter(i=>i!==-1)));
    render();
  }
  function showModal(icon,title,description,details,primaryText,primaryAction,secondaryText='Затвори',secondaryAction=hideModal){
    $('modalIcon').textContent=icon;$('modalTitle').textContent=title;$('modalDescription').textContent=description;$('modalDetails').textContent=details;
    $('modalPrimary').textContent=primaryText;$('modalSecondary').textContent=secondaryText;
    $('modal').classList.remove('hidden');$('modalPrimary').onclick=primaryAction;$('modalSecondary').onclick=secondaryAction;
  }
  function hideModal(){$('modal').classList.add('hidden');}
  function levelWin(){busy=true;tone(784,.24);showModal('✦','Нивото е завършено!','Магическата врата се отвори. Продължи към следващото предизвикателство.',`+ ${levelScore.toLocaleString('bg-BG')} точки`,save.level===100?'Нова обиколка →':'Следващо ниво →',()=>{if(save.level===100){save.level=1;save.cycles++;}else save.level++;persist();configureLevel();},'Остани тук',hideModal);}
  function levelLoss(){busy=true;tone(220,.3,'sawtooth');showModal('◇','Ходовете свършиха','Не успя да събереш всички руни. Опитай с различна стратегия.',`${levelScore.toLocaleString('bg-BG')} точки този опит`,'Опитай отново',configureLevel,'По-късно',hideModal);}
  function useHint(){if(busy||hints<=0)return;const match=findMove(board);if(!match){notice('Руните се пренареждат');busy=true;void ensureMove(generation).then(()=>{busy=false;render();});return;}hints--;render();mark(match,'hinted');notice('Размени осветените руни');tone(660,.15);}
  function useShuffle(){if(busy||shuffles<=0)return;shuffles--;busy=true;const walls=new Set(board.map((v,i)=>v===-1?i:-1).filter(i=>i!==-1));board=populate(walls);selected=null;busy=false;render();notice('Руните са разбъркани!');tone(610,.15);}
  $('hintBtn').addEventListener('click',useHint);$('shuffleBtn').addEventListener('click',useShuffle);
  $('restartBtn').addEventListener('click',()=>showModal('↻','Рестарт на нивото?','Текущите комбинации и събраните руни в това ниво ще се занулят. Общият резултат се запазва.','','Рестартирай',configureLevel,'Отказ',hideModal));
  $('helpBtn').addEventListener('click',()=>showModal('ᚠ','Как се играе','Избери руна и после съседна, за да ги размениш. Размяната е позволена само ако получиш три или повече еднакви по хоризонтала или вертикала. Събери целевите руни преди ходовете да свършат. Камъните не могат да се местят.','','Ясно!',hideModal));
  $('soundBtn').addEventListener('click',()=>{save.sound=!save.sound;persist();$('soundBtn').textContent=save.sound?'♫ Звук: ВКЛ.':'♫ Звук: ИЗКЛ.';if(save.sound)tone(600,.1);});
  $('soundBtn').textContent=save.sound?'♫ Звук: ВКЛ.':'♫ Звук: ИЗКЛ.';
  const legend=$('runeLegend');for(const rune of TYPES){const row=document.createElement('div');row.className='legend-item';const icon=document.createElement('span');icon.className='rune-mini';icon.textContent=rune.glyph;icon.style.color=rune.color;row.append(icon,document.createTextNode(rune.name));legend.append(row);}
  // Swipe for phones: start a swipe on a tile, release on a direct neighbor.
  $('board').addEventListener('pointerdown',e=>{const cell=e.target.closest('.cell.rune');if(cell)pointerStart={index:Number(cell.dataset.index),x:e.clientX,y:e.clientY};});
  $('board').addEventListener('pointerup',e=>{if(!pointerStart||busy)return;const {index,x,y}=pointerStart;pointerStart=null;const dx=e.clientX-x,dy=e.clientY-y;if(Math.max(Math.abs(dx),Math.abs(dy))<23)return;let dest=index;if(Math.abs(dx)>Math.abs(dy))dest+=dx>0?1:-1;else dest+=dy>0?SIZE:-SIZE;if(dest>=0&&dest<64&&neighbors(index,dest)&&board[dest]!==-1){selected=null;void doSwap(index,dest);}});
  configureLevel();
})();
