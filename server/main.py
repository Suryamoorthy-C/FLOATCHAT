from datetime import datetime, timezone
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import asyncio, json

app=FastAPI(title='FLOATCHAT API', version='0.1.0')
app.add_middleware(CORSMiddleware, allow_origins=['*'], allow_methods=['*'], allow_headers=['*'])
FLOATS=[
 {'platform_number':'2902746','project_name':'Indian Ocean Array','pi_name':'NIO Goa','lat':12.8,'lon':72.4,'status':'active','temperature_c':27.4,'salinity_psu':34.8,'last_seen':'2026-10-14T09:34:00Z'},
 {'platform_number':'2902751','project_name':'Bay of Bengal Survey','pi_name':'INCOIS','lat':16.2,'lon':80.1,'status':'active','temperature_c':26.9,'salinity_psu':35.1,'last_seen':'2026-10-14T09:28:00Z'},
 {'platform_number':'2902738','project_name':'Arabian Sea Watch','pi_name':'WHOI','lat':8.6,'lon':67.2,'status':'warning','temperature_c':29.8,'salinity_psu':33.9,'last_seen':'2026-10-14T09:20:00Z'},
 {'platform_number':'2902777','project_name':'Bay of Bengal Survey','pi_name':'INCOIS','lat':20.4,'lon':91.3,'status':'active','temperature_c':25.8,'salinity_psu':34.5,'last_seen':'2026-10-14T09:11:00Z'},
 {'platform_number':'2902699','project_name':'Southern Ocean Array','pi_name':'CSIRO','lat':-2.4,'lon':78.5,'status':'offline','temperature_c':None,'salinity_psu':None,'last_seen':'2026-10-11T09:42:00Z'},
 {'platform_number':'2902712','project_name':'Indian Ocean Array','pi_name':'NIO Goa','lat':3.2,'lon':61.6,'status':'active','temperature_c':28.2,'salinity_psu':34.2,'last_seen':'2026-10-14T08:42:00Z'}]
@app.get('/api/health')
def health(): return {'status':'ok','service':'floatchat-api'}
@app.get('/api/floats')
def floats(status: str|None=None, region: str|None=None):
    rows=[f for f in FLOATS if not status or f['status']==status]
    return {'count':len(rows),'data':rows,'source':'FLOATCHAT demo ARGO subset'}
@app.get('/api/floats/{float_id}/trajectory')
def trajectory(float_id: str):
    f=next((x for x in FLOATS if x['platform_number']==float_id), FLOATS[0])
    return {'float_id':f['platform_number'],'points':[{'lat':f['lat']-i*.35,'lon':f['lon']-i*.22,'cycle':184-i} for i in range(8)]}
@app.get('/api/profiles')
def profiles(float_id: str='2902746', param: str='temperature'):
    depth=[0,50,100,200,400,600,800,1000,1200,1500,1800]
    temp=[28.6,28.3,27.7,26.8,24.8,22.1,19.7,17.9,15.4,12.7,9.8]
    sal=[34.1,34.3,34.6,34.8,35.0,35.1,35.0,34.9,34.7,34.6,34.5]
    return {'float_id':float_id,'cycle':184,'parameter':param,'data':[{'depth_m':d,'value':(temp if param=='temperature' else sal)[i]} for i,d in enumerate(depth)],'citation':{'source':'ARGO GDAC','timestamp':'2026-10-14T09:34:00Z'}}
@app.get('/api/anomalies')
def anomalies(): return {'count':3,'data':[{'title':'Salinity spike','region':'Eastern Bay of Bengal','severity':'moderate','profiles':3},{'title':'Temperature drop','region':'Arabian Sea','severity':'high','float_id':'2902738'},{'title':'Coverage gap','region':'South Indian Ocean','severity':'info','hours':18}]}
@app.get('/api/stats/overview')
def stats(): return {'active_floats':2847,'profiles_week':14200,'anomalies':23,'coverage_percent':87.4,'synced_at':'2026-10-14T09:42:00Z'}
@app.post('/api/chat')
async def chat(payload: dict):
    question=(payload.get('message') or '').lower()
    if 'salin' in question: answer='Salinity is elevated at the eastern edge of the Bay of Bengal, with 3 cited profiles between 34.8 and 35.1 PSU. The strongest signal is around 600–1,000 m. I would treat this as a regional pattern, not a single-float anomaly.'
    elif 'anomal' in question: answer='I found 3 signals to watch: a moderate salinity spike in the eastern Bay of Bengal, a new temperature drop around ARGO 2902738, and an 18-hour coverage gap in the South Indian Ocean.'
    else: answer='I found a useful signal across the selected region. The map highlights 3 nearby profiles; compare their depth curves to separate a local event from a broader water-mass pattern.'
    async def stream():
        for word in answer.split():
            yield f'data: {json.dumps({"token":word+" "})}\n\n'; await asyncio.sleep(.015)
        yield f'data: {json.dumps({"done":True,"citations":["2902746","2902751","2902738"]})}\n\n'
    return StreamingResponse(stream(), media_type='text/event-stream')
