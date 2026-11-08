import { Text, View, Image } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../../src/context/ThemeContext';
import { APP_NAME, APP_VERSION, APP_BUILD } from '../../../src/constants/app';
import { AccountPage, Panel, SectionLabel, MenuRow, ui } from '../../../src/components/account/AccountUI';
interface TeamMember {
  id: string;
  name: string;
  role: string;
  description: string;
  image: any;
  social?: {
    github?: string;
    linkedin?: string;
    email?: string;
  };
}

const teamMembers: TeamMember[] = [
  {
    id: "0",
    name: "Kenneth C. Ampolitod",
    role: "Capstone Adviser",
    description: "Provides guidance, mentorship, and oversight throughout the project lifecycle. Ensures the project meets academic standards and industry best practices.",
    image: require("../../../assets/images/team/ampolitod.jpg"),
  },
  {
    id: "1",
    name: "Maikent Jeorge C. Lopez",
    role: "System Analyst",
    description: "Analyzes system requirements, designs architecture, and ensures the system meets all functional and non-functional requirements.",
    image: require("../../../assets/images/team/lopez.jpg"),
  },
  {
    id: "2",
    name: "Henna Christine C. Pajo",
    role: "Database Administrator",
    description: "Manages database design, optimization, and maintenance. Ensures data integrity, security, and efficient data retrieval.",
    image: require("../../../assets/images/team/pajo.jpg"),
  },
  {
    id: "3",
    name: "Harry S. Fernandez",
    role: "Technical Writer",
    description: "Documents system architecture, creates user manuals, and prepares technical documentation for the project.",
    image: require("../../../assets/images/team/fernandez.jpg"),
  },
  {
    id: "4",
    name: "Faisal R. Inidal",
    role: "Front End Developer",
    description: "Develops the user interface and experience of the mobile application. Ensures the app is responsive, intuitive, and visually appealing.",
    image: require("../../../assets/images/team/faisal.jpg"),
  },
  {
    id: "5",
    name: "Varren Meg M. Naive",
    role: "Backend Developer",
    description: "Develops server-side logic, API endpoints, and database integration. Ensures the system is scalable, secure, and performs efficiently.",
    image: require("../../../assets/images/team/naive.jpg"),
  },
];


export default function AboutScreen() {
  const { colors } = useTheme();
  return <AccountPage title="About AIMS">
    <View style={{ backgroundColor: '#0b0b2f', borderRadius: 24, padding: 24, gap: 16, borderWidth: 1, borderColor: '#303056' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}><Image source={require('../../../assets/images/aims-identity-icon.png')} style={{ width: 68, height: 68, borderRadius: 18 }} accessibilityLabel="AIMS logo" /><View style={{ flex: 1 }}><Text style={{ color: '#FFC629', fontSize: 10, letterSpacing: 1.8, fontWeight: '700' }}>CITC · USTP CDO</Text><Text style={{ color: '#FFFFFF', fontSize: 33, fontWeight: '800', letterSpacing: -1, marginTop: 4 }}>AIMS</Text></View></View>
      <Text style={{ color: '#FFFFFF', fontSize: 18, lineHeight: 25, fontWeight: '600' }}>{APP_NAME}</Text><Text style={{ color: '#D1D4E8', fontSize: 13, lineHeight: 22 }}>Connecting students, the university and industry partners throughout the internship journey.</Text><Text style={{ color: '#FFC629', fontSize: 12 }}>{APP_VERSION} · Build {APP_BUILD}</Text><Text style={{ color: '#D1D4E8', fontSize: 12, lineHeight: 19 }}>Include this running app version and build when reporting a problem.</Text>
    </View>
    <SectionLabel title="Available features" />
    <Panel><MenuRow icon="school-outline" title="Get eligible and apply" detail="Orientation/COR review, approved forms, document replacement history and application-linked endorsement." /><MenuRow icon="briefcase-outline" title="Acceptance and deployment" detail="Company application decisions, school-arranged placement proposals and coordinator deployment approval." /><MenuRow icon="time-outline" title="Attendance and learning" detail="Photo/location capture, reported-accuracy notices, DTR review, time-correction requests and weekly journals." /><MenuRow icon="ribbon-outline" title="Completion and archive" detail="Eligibility checklist, student request, company confirmation, coordinator final approval and separately released grades." /><MenuRow icon="notifications-outline" title="Account and updates" detail="Notification preferences, supported phone alerts, password reset and sign-in session management." /></Panel>
    <SectionLabel title="Who uses AIMS?" hint="Students use mobile and web. Other stakeholders use their authorized web workspaces." />
    <Panel><MenuRow icon="person-outline" title="Student" detail="Submits personal records and follows application, deployment and completion progress." /><MenuRow icon="people-outline" title="Coordinator" detail="Reviews assigned students, requirements, attendance, deployment and completion." /><MenuRow icon="business-outline" title="Company supervisor" detail="Reviews linked-company applications, monitors interns and handles company-side confirmations and corrections." /><MenuRow icon="briefcase-outline" title="Career Center" detail="Manages company partnerships, MOA files and partnership-related placement reviews." /><MenuRow icon="school-outline" title="Dean" detail="Reviews scoped internship analytics, partner information and permitted placement decisions." /><MenuRow icon="settings-outline" title="Administrator" detail="Manages accounts, coordinator designations, assignments, academic requirements and company-supervisor links." /><Text style={[ui.description, { color: colors.textSecondary }]}>Each role sees only the records and actions allowed by its access and assignments. OCR supports text checks; it does not authenticate signatures. Location is a device estimate and does not prove attendance on its own.</Text></Panel>
    <SectionLabel title="Project adviser" />
    <Panel><View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}><Image source={teamMembers[0].image} style={{ width: 64, height: 64, borderRadius: 18 }} /><View style={{ flex: 1 }}><Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '700' }}>{teamMembers[0].name}</Text><Text style={{ color: colors.accent, fontSize: 12, marginTop: 5 }}>{teamMembers[0].role}</Text></View></View><Text style={[ui.description, { color: colors.textSecondary }]}>{teamMembers[0].description}</Text></Panel>
    <SectionLabel title="The team behind AIMS" hint="A capstone project developed for the CITC internship community." />
    <Panel>{teamMembers.slice(1).map((member, index) => <View key={member.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 12, borderTopWidth: index ? 1 : 0, borderColor: colors.border }}><Image source={member.image} style={{ width: 52, height: 52, borderRadius: 16 }} /><View style={{ flex: 1 }}><Text style={{ color: colors.textPrimary, fontSize: 14, lineHeight: 21, fontWeight: '600' }}>{member.name}</Text><Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 3 }}>{member.role}</Text></View></View>)}</Panel>
    <Panel><MenuRow icon="help-buoy-outline" title="Help & support" onPress={() => router.push('/(student)/settings/help-support')} /><MenuRow icon="shield-checkmark-outline" title="Privacy policy" onPress={() => router.push('/(student)/settings/privacy-policy')} /><MenuRow icon="document-text-outline" title="Terms & conditions" onPress={() => router.push('/(student)/settings/terms')} /></Panel>
    <Text style={[ui.description, { textAlign: 'center', color: colors.textTertiary }]}>© {new Date().getFullYear()} AIMS Team</Text>
  </AccountPage>;
}
