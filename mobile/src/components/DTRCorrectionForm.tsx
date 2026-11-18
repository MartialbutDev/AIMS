import { useEffect, useState } from 'react'
import { View, Text, TextInput, Button, Alert, Platform } from 'react-native'
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker'
import api from '../services/api'
import { useTheme } from '../context/ThemeContext'
interface Correction { id:string; dtr_id:string; status:string; history:{action:string;reason:string;at:string}[] }

function toApiTime(value: string): string | null {
  const match = /^(0?[1-9]|1[0-2]):([0-5]\d)\s*(AM|PM)$/i.exec(value.trim())
  if (!match) return null

  const [, hours, minutes, period] = match
  const hour = Number(hours) % 12 + (period.toUpperCase() === 'PM' ? 12 : 0)
  return `${String(hour).padStart(2, '0')}:${minutes}`
}

type TimeField = 'start' | 'end'

function formatPickerTime(value: Date): string {
  const hours = value.getHours()
  const minutes = String(value.getMinutes()).padStart(2, '0')
  return `${hours % 12 || 12}:${minutes} ${hours < 12 ? 'AM' : 'PM'}`
}

export default function DTRCorrectionForm({dtrId}:{dtrId:string}) {
  const {colors}=useTheme()
  const [start,setStart]=useState('')
  const [end,setEnd]=useState('')
  const [picker, setPicker] = useState<{ field: TimeField; value: Date } | null>(null)
  const [reason,setReason]=useState('')
  const [rows,setRows]=useState<Correction[]>([])
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  async function load(){
    try{const result=await api.get('/dtr-corrections');setRows(result.data.filter((row:Correction)=>row.dtr_id===dtrId));setError('')}
    catch{setError('Could not load correction history')}
  }
  useEffect(()=>{void load()},[dtrId])

  function applyPickedTime(field: TimeField, value: Date) {
    const setTime = field === 'start' ? setStart : setEnd
    setTime(formatPickerTime(value))
  }

  function openPicker(field: TimeField) {
    const time = toApiTime(field === 'start' ? start : end)
    const [hours, minutes] = time ? time.split(':').map(Number) : [field === 'start' ? 8 : 17, 0]
    const value = new Date()
    value.setHours(hours, minutes, 0, 0)

    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value,
        mode: 'time',
        is24Hour: false,
        onChange: (event, selected) => {
          if (event.type === 'set' && selected) applyPickedTime(field, selected)
        },
      })
    } else {
      setPicker({ field, value })
    }
  }

  async function submit(){
    const timeIn = toApiTime(start)
    const timeOut = toApiTime(end)
    if (!timeIn || !timeOut) {
      Alert.alert('Check correction', 'Enter both times with AM or PM, for example 8:00 AM and 5:00 PM.')
      return
    }
    if (reason.trim().length < 10) {
      Alert.alert('Check correction', 'Enter a reason of at least 10 characters.')
      return
    }
    setBusy(true)
    try{await api.post('/dtr-corrections/'+dtrId,{time_in:timeIn,time_out:timeOut,reason});Alert.alert('Request sent','Your company supervisor will review your attendance first.');await load()}
    catch(e:any){Alert.alert('Correction unavailable',typeof e.response?.data?.detail==='string'?e.response.data.detail:'Please check the times and try again.')}
    finally{setBusy(false)}
  }
  const style={color:colors.textPrimary,borderColor:colors.textPrimary,borderWidth:1,padding:12,borderRadius:8,marginVertical:6}
  const hasNativePicker = Platform.OS === 'android' || Platform.OS === 'ios'
  function renderTimeField(field: TimeField, label: string, value: string, setValue: (value: string) => void, placeholder: string) {
    return <View style={{ marginBottom: 12 }}>
      <Text style={{ color: colors.textPrimary }}>{label} (AM/PM)</Text>
      <TextInput accessibilityLabel={`Requested ${label.toLowerCase()}, including AM or PM`} placeholder={placeholder} placeholderTextColor={colors.textSecondary} autoCapitalize="characters" autoCorrect={false} value={value} onChangeText={setValue} style={style}/>
      {hasNativePicker && <Button title={`Choose ${label.toLowerCase()} time`} disabled={busy || picker !== null} onPress={() => openPicker(field)} />}
      {Platform.OS === 'ios' && picker?.field === field && <>
        <DateTimePicker mode="time" display="spinner" locale="en-US" value={picker.value}
          onChange={(_, selected) => { if (selected) setPicker({ field, value: selected }) }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Button title="Cancel" onPress={() => setPicker(null)} />
          <Button title="Use this time" onPress={() => { applyPickedTime(field, picker.value); setPicker(null) }} />
        </View>
      </>}
    </View>
  }

  return <View style={{padding:20}}>
    <Text style={{color:colors.textPrimary,fontSize:18,fontWeight:'700'}}>Request DTR correction</Text>
    {rows.map(row=><Text key={row.id} style={{color:colors.textPrimary}}>{row.status.replaceAll('_',' ')}{'\n'}{row.history.map(event=>event.reason).join('\n')}</Text>)}
    {!!error&&<Text style={{color:colors.textPrimary}}>{error}</Text>}
    {renderTimeField('start', 'Clock-in', start, setStart, '8:00 AM')}
    {renderTimeField('end', 'Clock-out', end, setEnd, '5:00 PM')}
    <Text style={{color:colors.textPrimary}}>Reason</Text><TextInput accessibilityLabel="Correction reason" multiline maxLength={1000} value={reason} onChangeText={setReason} style={style}/>
    <Button title={busy?'Sending…':'Send correction request'} disabled={busy || picker !== null} onPress={submit}/>
  </View>
}
