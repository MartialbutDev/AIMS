import { useEffect, useState } from 'react'
import { View, Text, TextInput, Button, Alert } from 'react-native'
import api from '../services/api'
import { useTheme } from '../context/ThemeContext'
interface Correction { id:string; dtr_id:string; status:string; history:{action:string;reason:string;at:string}[] }
export default function DTRCorrectionForm({dtrId}:{dtrId:string}) {
  const {colors}=useTheme()
  const [start,setStart]=useState('')
  const [end,setEnd]=useState('')
  const [reason,setReason]=useState('')
  const [rows,setRows]=useState<Correction[]>([])
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  async function load(){
    try{const result=await api.get('/dtr-corrections');setRows(result.data.filter((row:Correction)=>row.dtr_id===dtrId));setError('')}
    catch{setError('Could not load correction history')}
  }
  useEffect(()=>{void load()},[dtrId])
  async function submit(){
    if(!/^\d{2}:\d{2}$/.test(start)||!/^\d{2}:\d{2}$/.test(end)||reason.trim().length<10){
      Alert.alert('Check correction','Enter times as HH:MM (24-hour clock) and a reason of at least 10 characters.');return
    }
    setBusy(true)
    try{await api.post('/dtr-corrections/'+dtrId,{time_in:start,time_out:end,reason});Alert.alert('Request sent','Your company supervisor will review your attendance first.');await load()}
    catch(e:any){Alert.alert('Correction unavailable',typeof e.response?.data?.detail==='string'?e.response.data.detail:'Please check the times and try again.')}
    finally{setBusy(false)}
  }
  const style={color:colors.textPrimary,borderColor:colors.textPrimary,borderWidth:1,padding:12,borderRadius:8,marginVertical:6}
  return <View style={{padding:20}}>
    <Text style={{color:colors.textPrimary,fontSize:18,fontWeight:'700'}}>Request DTR correction</Text>
    {rows.map(row=><Text key={row.id} style={{color:colors.textPrimary}}>{row.status.replaceAll('_',' ')}{'\n'}{row.history.map(event=>event.reason).join('\n')}</Text>)}
    {!!error&&<Text style={{color:colors.textPrimary}}>{error}</Text>}
    <Text style={{color:colors.textPrimary}}>Clock-in (HH:MM)</Text><TextInput accessibilityLabel="Requested clock-in" value={start} onChangeText={setStart} style={style}/>
    <Text style={{color:colors.textPrimary}}>Clock-out (HH:MM)</Text><TextInput accessibilityLabel="Requested clock-out" value={end} onChangeText={setEnd} style={style}/>
    <Text style={{color:colors.textPrimary}}>Reason</Text><TextInput accessibilityLabel="Correction reason" multiline maxLength={1000} value={reason} onChangeText={setReason} style={style}/>
    <Button title={busy?'Sending…':'Send correction request'} disabled={busy} onPress={submit}/>
  </View>
}

