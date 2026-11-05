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
      <Text style={{ color: '#FFFFFF', fontSize: 18, lineHeight: 25, fontWeight: '600' }}>{APP_NAME}</Text><Text style={{ color: '#D1D4E8', fontSize: 13, lineHeight: 22 }}>Connecting students, the university and industry partners throughout the internship journey.</Text><Text style={{ color: '#FFC629', fontSize: 12 }}>{APP_VERSION} · Build {APP_BUILD}</Text>
    </View>
    <SectionLabel title="One internship journey" />
    <Panel><MenuRow icon="briefcase-outline" title="Find your placement" detail="Applications, approved forms and deployment requirements." /><MenuRow icon="time-outline" title="Record your experience" detail="Daily time records, journals and coordinator feedback." /><MenuRow icon="ribbon-outline" title="Complete with confidence" detail="Completion review, released grades and internship records." /></Panel>
    <SectionLabel title="Project adviser" />
    <Panel><View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}><Image source={teamMembers[0].image} style={{ width: 64, height: 64, borderRadius: 18 }} /><View style={{ flex: 1 }}><Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '700' }}>{teamMembers[0].name}</Text><Text style={{ color: colors.accent, fontSize: 12, marginTop: 5 }}>{teamMembers[0].role}</Text></View></View><Text style={[ui.description, { color: colors.textSecondary }]}>{teamMembers[0].description}</Text></Panel>
    <SectionLabel title="The team behind AIMS" hint="A capstone project developed for the CITC internship community." />
    <Panel>{teamMembers.slice(1).map((member, index) => <View key={member.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 12, borderTopWidth: index ? 1 : 0, borderColor: colors.border }}><Image source={member.image} style={{ width: 52, height: 52, borderRadius: 16 }} /><View style={{ flex: 1 }}><Text style={{ color: colors.textPrimary, fontSize: 14, lineHeight: 21, fontWeight: '600' }}>{member.name}</Text><Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 3 }}>{member.role}</Text></View></View>)}</Panel>
    <Panel><MenuRow icon="help-buoy-outline" title="Help & support" onPress={() => router.push('/(student)/settings/help-support')} /><MenuRow icon="shield-checkmark-outline" title="Privacy policy" onPress={() => router.push('/(student)/settings/privacy-policy')} /></Panel>
    <Text style={[ui.description, { textAlign: 'center', color: colors.textTertiary }]}>© {new Date().getFullYear()} AIMS Team</Text>
  </AccountPage>;
}
