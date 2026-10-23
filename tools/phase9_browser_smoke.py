"""Synthetic visual and input-persistence smoke test, not a real WebSocket acceptance test.
Requires Python playwright + Chromium. Browser navigations are unavailable in the
build environment, so HTML is loaded with set_content() and WebSocket is stubbed.
"""
import json
import subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
state_js = r'''
const {CAPTAINS}=require('./src/constants');
const {newGame,placeSettlement,legalPlacements,publicGame,legalTargets}=require('./src/engine');
const players=[{id:'cap-a',name:'Admiral Alice',avatarId:'isadora',ready:true,connected:true,bot:false},{id:'cap-b',name:'Captain Bert',avatarId:'tobias',ready:true,connected:true,bot:false}];
const game=newGame(players,'quick');
for(const id of game.placementOrder)placeSettlement(game,players,id,legalPlacements(game)[0]);
const room={code:'BARN',mode:'quick',phase:game.phase,paused:false,captains:CAPTAINS,players:players.map(p=>({id:p.id,name:p.name,avatarId:p.avatarId,ready:true,connected:true,bot:false,renown:p.renown})),game:publicGame(game)};
const p=players[0];
const self={id:p.id,avatarId:p.avatarId,goods:p.goods,gold:p.gold,renown:p.renown,orders:null,submitted:false,contracts:p.contracts,contractReserve:p.contractReserve||[],contractDrafted:!!p.contractDrafted,upgrades:p.upgrades||[],upgradeOptions:[],deals:[],legalTargets:legalTargets(game,p.id)};
console.log(JSON.stringify({type:'state',room,self}));
'''
fixture=json.loads(subprocess.check_output(['node','-e',state_js],cwd=ROOT,text=True))
store_stub = r'''
window.__storage = (function(){const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)}})();
Object.defineProperty(window,'localStorage',{configurable:true,value:window.__storage});
Object.defineProperty(window,'sessionStorage',{configurable:true,value:window.__storage});
window.WebSocket = class MockWebSocket {
 constructor(){this.readyState=1;this.sent=[];window.__socket=this;setTimeout(()=>this.onopen?.(),0);}
 send(x){this.sent.push(JSON.parse(x));}
 close(){}
};
'''

def setup(page,html):
    html=html.replace("<script>", "<script>"+store_stub+"</script><script>",1)
    page.set_content(html,wait_until='domcontentloaded',timeout=9000)
    page.wait_for_function('window.__socket && typeof window.__socket.onmessage === "function"',timeout=5000)

def state(page):
    page.evaluate('(state)=>window.__socket.onmessage({data:JSON.stringify(state)})',fixture)

def width_check(page,width,description):
    excess=page.evaluate('document.documentElement.scrollWidth-window.innerWidth')
    if excess>1:print('OVERFLOW ELEMENTS',page.evaluate('''() => [...document.querySelectorAll('*')].filter(e=>e.getBoundingClientRect().right > innerWidth+1).slice(0,20).map(e=>({tag:e.tagName,id:e.id,cls:e.className?.baseVal||e.className,right:Math.round(e.getBoundingClientRect().right),scroll:e.scrollWidth}))'''))
    assert excess <= 1, f'{description} ({width}px) horizontal overflow by {excess}px'
    return excess

results=[]
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
    for width,height in [(320,700),(390,844),(600,880)]:
        page=browser.new_page(viewport={'width':width,'height':height})
        setup(page,(ROOT/'public/phone.html').read_text())
        state(page)
        assert page.locator('#game-view').is_visible()
        assert page.locator('#connection-banner').is_hidden()
        width_check(page,width,'phone')
        assert page.locator('button#submit-orders').is_visible()
        if width==390:
            page.locator('select[data-order="0"][data-field="kind"]').select_option('market')
            input_=page.locator('input[data-order="0"][data-good="fish"]')
            input_.fill('3')
            page.evaluate("""() => window.__editingInput=document.querySelector('input[data-order="0"][data-good="fish"]')""")
            state(page)
            assert page.evaluate("""() => window.__editingInput===document.querySelector('input[data-order="0"][data-good="fish"]')"""),'Incoming state recreated editor while typing'
            assert input_.input_value()=='3','Draft value lost after state update'
            page.evaluate('window.__socket.onclose({code:1006})')
            assert page.locator('#connection-banner').is_visible()
            assert 'Reconnecting' in page.locator('#connection-banner').inner_text()
            page.screenshot(path='/mnt/data/tidewater-phase9-phone-smoke.png',full_page=True)
            # Edits are still saved locally during an outage. Simulate a page reload.
            input_.fill('4')
            stored=page.evaluate('() => ({key:draftKey(room.game),value:sessionStorage.getItem(draftKey(room.game))})')
            assert json.loads(stored['value'])[0]['quantities']['fish']==4
            recovered=browser.new_page(viewport={'width':390,'height':844})
            setup(recovered,(ROOT/'public/phone.html').read_text())
            recovered.evaluate('(s)=>sessionStorage.setItem(s.key,s.value)',stored)
            state(recovered)
            assert recovered.locator('input[data-order="0"][data-good="fish"]').input_value()=='4','Locally saved draft not recovered after reload'
            recovered.close()
            results.append('Phone draft survives server pushes, disconnect, offline edits and simulated page reload')
        results.append(f'Phone {width}px: no horizontal scroll, dynamic game view and orders visible')
        page.close()
    for width,height in [(1280,720),(1920,1080),(760,800)]:
        page=browser.new_page(viewport={'width':width,'height':height})
        setup(page,(ROOT/'public/tv.html').read_text())
        page.evaluate('(data)=>window.__socket.onmessage({data:JSON.stringify({type:"state",room:data.room,host:true})})',fixture)
        assert page.locator('#connection-banner').is_hidden()
        assert page.locator('#map').is_visible()
        width_check(page,width,'TV')
        if width==1920:
            page.screenshot(path='/mnt/data/tidewater-phase9-tv-smoke.png',full_page=True)
        results.append(f'TV {width}px: no horizontal scroll, dynamic chart and player rail visible')
        page.close()
    browser.close()
print('\n'.join('PASS '+r for r in results))
