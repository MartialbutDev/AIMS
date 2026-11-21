import { applicationSteps, applicationStep } from '../utils/applicationFlow'
import { useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import api from '../services/api'
import { useTheme } from '../context/ThemeContext'

interface Journey {
  stage: string
  application_status: string
  is_current_term: boolean
  academic_year: string
  semester: string
  endorsement: { ready: boolean; status: string; document_id: string | null; review_notes: string | null }
  checklist: { ready_for_deployment: boolean } | null
}
const steps = applicationSteps
const guidance = Object.fromEntries(['upload_endorsement','endorsement_review','coordinator_review','company_review','pre_deployment','deployment_approval','deployed','completed'].map(stage => {
  const state = applicationStep(stage)!
  return [stage, { step: state.index, title: state.index < steps.length ? steps[state.index] : stage === 'completed' ? 'Internship completed' : 'Deployment approved', description: state.message }]
}))

export function ApplicationJourney({ applicationId }: { applicationId: string }) {
  const { colors, isDark } = useTheme()
  const { width, fontScale } = useWindowDimensions()
  const compact = width < 360 || fontScale > 1.2
  const [journey, setJourney] = useState<Journey | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [showSteps, setShowSteps] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    api.get(`/applications/${encodeURIComponent(applicationId)}/journey`, { signal: controller.signal })
      .then(response => { if (!controller.signal.aborted) setJourney(response.data) })
      .catch(() => { if (!controller.signal.aborted) setError('Could not load your next step. Please retry.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [applicationId, revision])
  const current = journey ? guidance[journey.stage] : undefined
  const closed = !!journey && ['rejected', 'withdrawn', 'cancelled'].includes(journey.stage)
  const historical = !!journey && !journey.is_current_term
  const canAct = !!journey?.is_current_term && !closed
  const currentStep = current ? Math.min(current.step + 1, steps.length) : 1
  const completeColor = isDark ? '#6879B8' : '#0B0B2F'
  const gold = '#FFC629'
  const stateLabels: Record<string, string> = {
    upload_endorsement: 'YOUR ACTION', endorsement_review: 'WITH YOUR COORDINATOR',
    coordinator_review: 'WITH YOUR COORDINATOR', company_review: 'WITH THE COMPANY',
    pre_deployment: 'YOUR ACTION', deployment_approval: 'WITH YOUR COORDINATOR',
    deployed: 'INTERNSHIP ACTIVE', completed: 'COMPLETED',
  }
  let primaryAction: { label: string; onPress: () => void } | null = null
  if (canAct && journey?.stage === 'upload_endorsement') {
    primaryAction = {
      label: journey.endorsement.status === 'missing' ? 'Upload endorsement letter' : 'Upload corrected letter',
      onPress: () => router.push({ pathname: '/(student)/documents/upload', params: { type: 'endorsement_letter', applicationId } }),
    }
  } else if (canAct && journey && ['pre_deployment', 'deployment_approval'].includes(journey.stage) && journey.checklist) {
    primaryAction = { label: 'Open pre-deployment checklist', onPress: () => router.push('/(student)/pre-deployment') }
  } else if (canAct && journey?.stage === 'deployed') {
    primaryAction = { label: 'Open daily attendance', onPress: () => router.push('/(student)/dtr') }
  } else if (journey?.stage === 'completed') {
    primaryAction = { label: 'Open Completion & Archive', onPress: () => router.push('/(student)/completion') }
  }
  if (canAct && journey && applicationStep(journey.stage)?.kind === 'refresh') primaryAction = { label: 'Refresh status', onPress: () => setRevision(value => value + 1) }
  const documentId = journey?.endorsement.document_id

  return <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, compact && styles.compactCard]}>
    <View style={styles.heading}>
      <View style={styles.headingCopy}>
        <Text style={[styles.headingTitle, { color: colors.textPrimary }]}>Application progress</Text>
        {!loading && !error && journey && <Text style={[styles.headingSubtitle, { color: colors.textSecondary }]}>
          {closed ? 'Application closed' : journey.stage === 'completed' ? 'All stages completed' : `Step ${currentStep} of ${steps.length}`}
        </Text>}
      </View>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Refresh application steps" accessibilityState={{ disabled: loading }}
        disabled={loading} style={[styles.refresh, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}
        onPress={() => setRevision(value => value + 1)}>
        <Ionicons name="refresh-outline" size={19} color={colors.accent} />
      </TouchableOpacity>
    </View>

    {loading ? <View style={styles.stateContent}>
      <ActivityIndicator color={colors.accent} />
      <Text style={[styles.body, { color: colors.textSecondary }]}>Checking your application…</Text>
    </View> : error ? <View style={[styles.error, { backgroundColor: colors.surfaceSecondary }]}>
      <Ionicons name="alert-circle-outline" size={24} color={colors.error} />
      <Text accessibilityRole="alert" style={[styles.body, styles.flex, { color: colors.textPrimary }]}>{error}</Text>
    </View> : journey && <>
      <View accessibilityRole="progressbar" accessibilityLabel="Application stage" accessibilityValue={{ min: 1, max: steps.length, now: currentStep, text: closed ? 'Application closed' : `Step ${currentStep} of ${steps.length}` }} style={styles.progressTrack}>
        {steps.map((title, index) => <View key={title} style={[styles.progressSegment, {
          backgroundColor: index === 0 || (!closed && current && index < current.step) ? completeColor
            : !closed && current?.step === index ? gold : colors.border,
        }]} />)}
      </View>

      <View style={[styles.nextAction, { backgroundColor: isDark ? '#202640' : '#0B0B2F' }]}>
        <View style={styles.actionHeading}>
          <Ionicons name={closed ? 'close-circle-outline' : journey.stage === 'completed' ? 'checkmark-circle-outline' : primaryAction ? 'arrow-forward-circle-outline' : 'time-outline'} size={20} color={gold} />
          <Text style={[styles.actionLabel, { color: gold }]}>{closed ? 'APPLICATION CLOSED' : historical ? 'APPLICATION HISTORY' : stateLabels[journey.stage]}</Text>
        </View>
        <Text style={[styles.actionTitle, compact && styles.compactTitle]}>{closed ? `Application ${journey.stage}` : historical ? 'Your previous application' : current?.title}</Text>
        <Text style={styles.actionDescription}>{closed ? 'Review the feedback below for the outcome of this application.' : historical ? `AY ${journey.academic_year} · Semester ${journey.semester}. Read-only record.` : current?.description}</Text>
        {journey.stage === 'pre_deployment' && !journey.checklist && <Text style={styles.actionDescription}>Your coordinator is preparing the deployment checklist. Contact them if it remains unavailable.</Text>}
        {primaryAction && <TouchableOpacity accessibilityRole="button" activeOpacity={0.8} onPress={primaryAction.onPress} style={[styles.primaryButton, { backgroundColor: gold }, isDark && { backgroundColor: false ? colors.surfaceTertiary : colors.accent }]}>
          <Text style={[styles.primaryButtonText, isDark && { color: (false ? colors.textSecondary : colors.onAccent) }]}>{primaryAction.label}</Text><Ionicons name="arrow-forward" size={18} color={isDark ? (false ? colors.textSecondary : colors.onAccent) : "#0B0B2F"} />
        </TouchableOpacity>}
        {documentId && !closed && <TouchableOpacity accessibilityRole="button" activeOpacity={0.7} style={styles.documentLink}
          onPress={() => router.push({ pathname: '/(student)/documents/[id]', params: { id: documentId } })}>
          <Ionicons name="document-text-outline" size={18} color="#E8ECFF" /><Text style={styles.documentLinkText}>View endorsement letter</Text><Ionicons name="chevron-forward" size={15} color="#E8ECFF" />
        </TouchableOpacity>}
      </View>

      {journey.endorsement.review_notes && <View style={[styles.feedback, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
        <View style={styles.feedbackHeading}><Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.accent} /><Text style={[styles.feedbackLabel, { color: colors.textPrimary }]}>Endorsement feedback</Text></View>
        <Text style={[styles.body, { color: colors.textSecondary }]}>{journey.endorsement.review_notes}</Text>
      </View>}

      <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: showSteps }} onPress={() => setShowSteps(value => !value)} style={{ minHeight: 44, justifyContent: 'center', marginTop: 12 }}><Text style={{ color: colors.accent, fontWeight: '600' }}>{showSteps ? 'Hide steps' : 'All application steps'}</Text></TouchableOpacity>
      {showSteps && <View style={styles.timeline}>
        {steps.map((title, index) => {
          const done = index === 0 || (!closed && !!current && index < current.step)
          const active = !closed && current?.step === index
          return <View key={title} style={styles.stepRow} accessibilityLabel={`${title}, ${done ? 'completed' : active ? 'current step' : closed ? 'not reached' : 'upcoming'}`}>
            <View style={styles.rail}>
              <View style={[styles.stepCircle, { backgroundColor: done ? completeColor : active ? gold : colors.card, borderColor: done ? completeColor : active ? gold : colors.border }]}>
                {done ? <Ionicons name="checkmark" size={18} color="#FFFFFF" /> : <Text style={[styles.stepNumber, { color: active ? '#0B0B2F' : colors.textTertiary }]}>{index + 1}</Text>}
              </View>
              {index < steps.length - 1 && <View style={[styles.connector, { backgroundColor: done ? completeColor : colors.border }]} />}
            </View>
            <View style={[styles.stepCopy, active && { backgroundColor: colors.accentMuted }]}>
              <Text style={[styles.stepTitle, { color: active ? colors.accent : done ? colors.textPrimary : colors.textSecondary, fontWeight: active ? '700' : '500' }]}>{title}</Text>
              {active && <Text style={[styles.currentLabel, { color: colors.accent }]}>Current step</Text>}
            </View>
          </View>
        })}
      </View>}
    </>}
  </View>
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 22, padding: 18, marginBottom: 20 },
  compactCard: { padding: 14 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headingCopy: { flex: 1 },
  headingTitle: { fontSize: 19, fontWeight: '700', letterSpacing: -0.3 },
  headingSubtitle: { fontSize: 13, lineHeight: 19, marginTop: 4 },
  refresh: { width: 46, height: 46, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  progressTrack: { flexDirection: 'row', gap: 5, marginTop: 18, marginBottom: 18 },
  progressSegment: { flex: 1, height: 4, borderRadius: 2 },
  nextAction: { borderRadius: 16, padding: 18, gap: 12 },
  actionHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionLabel: { flex: 1, fontSize: 10, letterSpacing: 1.1, fontWeight: '700', lineHeight: 16 },
  actionTitle: { color: '#FFFFFF', fontSize: 23, lineHeight: 30, letterSpacing: -0.5, fontWeight: '700' },
  compactTitle: { fontSize: 21, lineHeight: 28 },
  actionDescription: { color: '#CED5E9', fontSize: 14, lineHeight: 22 },
  primaryButton: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14, minHeight: 50, borderRadius: 12, marginTop: 4 },
  primaryButtonText: { flex: 1, color: '#0B0B2F', fontSize: 14, lineHeight: 21, fontWeight: '700' },
  documentLink: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, paddingVertical: 8 },
  documentLinkText: { flex: 1, color: '#E8ECFF', fontSize: 13, lineHeight: 20 },
  feedback: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 8, marginTop: 14 },
  feedbackHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  feedbackLabel: { flex: 1, fontSize: 13, fontWeight: '700' },
  body: { fontSize: 14, lineHeight: 22 },
  timeline: { marginTop: 22 },
  stepRow: { flexDirection: 'row', gap: 12, minHeight: 57 },
  rail: { width: 32, alignItems: 'center' },
  stepCircle: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, justifyContent: 'center', alignItems: 'center', marginTop: 4 },
  stepNumber: { fontSize: 13, fontWeight: '700' },
  connector: { width: 2, flex: 1, minHeight: 13, marginVertical: 4 },
  stepCopy: { flex: 1, paddingHorizontal: 11, paddingVertical: 9, borderRadius: 10, marginBottom: 12, justifyContent: 'center' },
  stepTitle: { fontSize: 14, lineHeight: 21 },
  currentLabel: { fontSize: 11, lineHeight: 17, marginTop: 3, fontWeight: '600' },
  stateContent: { paddingVertical: 30, alignItems: 'center', gap: 12 },
  error: { flexDirection: 'row', gap: 10, padding: 16, borderRadius: 12, marginTop: 18 },
  flex: { flex: 1 },
})
