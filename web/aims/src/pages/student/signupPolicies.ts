export type SignupPolicyKind = 'terms' | 'privacy'

export const signupPolicies = {
  "terms": {
    "title": "Terms and Conditions",
    "updated": "November 19, 2026",
    "sections": [
      {
        "title": "1. Purpose and use",
        "body": "AIMS supports student onboarding, internship applications, documents, deployment, attendance, journals and completion. Students use the mobile app or student web portal with the same account. Coordinators, company supervisors, the Career Center, Dean and administrators act through their authorized roles. Using AIMS does not by itself guarantee a placement, completion, a grade or graduation."
      },
      {
        "title": "2. Your account and security",
        "body": "Use your own registered identity and provide accurate student, academic and contact details. Keep your password and one-time codes private. Do not share accounts, impersonate another user or create accounts to bypass restrictions. Review your active sessions and end unfamiliar sessions. Report suspected unauthorized access to the school administrator through official channels."
      },
      {
        "title": "3. Eligibility, applications and deployment",
        "body": "Approved orientation and current-term Certificate of Registration (COR) records are required before an application can advance. Submit the required application documents and school-issued endorsement letter; the endorsement must be approved before forwarding to the company. Company acceptance does not authorize deployment. Complete the applicable pre-deployment requirements and wait for coordinator approval before using deployed-intern attendance features. Follow the academic term, requirements and deadlines applicable to your placement."
      },
      {
        "title": "4. Documents and assisted review",
        "body": "Upload readable, relevant documents you are authorized to submit, using the correct document type and approved form version where provided. Do not submit fabricated records or claim a signature belongs to another person. Text extraction and OCR assist document checks; they do not authenticate signatures, establish document authenticity or replace the responsible reviewer. A submission may be returned, rejected or require human review. Keep originals available when the school or company requests them."
      },
      {
        "title": "5. Replacements, deletion and history",
        "body": "An approved document can remain current while a replacement is reviewed. An approved replacement becomes current while review history is retained. Previously submitted application attachments remain associated with that application. Delete or hide controls are available only where permitted; hiding an item does not erase its server record, reviews, application attachments or academic history. Contact your coordinator about corrections or removal requests affecting retained records."
      },
      {
        "title": "6. Attendance, photographs and location",
        "body": "Record your own actual attendance and submit the requested clock-in or clock-out photo. When you capture location, the app requests device permission and sends the captured coordinates with your attendance submission. Location accuracy depends on the device, permissions, GPS and available network signals; a captured coordinate or photo alone is not proof of presence. Check the location before submitting, and report an inaccurate reading to your coordinator. Do not falsify times, reuse another person's evidence or manipulate location. If capture fails or permission is unavailable, contact your coordinator for guidance."
      },
      {
        "title": "7. Reviews, corrections and completion",
        "body": "Only approved attendance contributes to completion hours. Use the time-correction process for incorrect recorded times; company review and coordinator approval are required. Submit journals and address review feedback. Internship completion requires the applicable eligibility checklist, student request, company confirmation and coordinator final approval. Official grades are posted in USTP PRISM. Archived completion records may be protected from ordinary edits."
      },
      {
        "title": "8. Privacy and authorized access",
        "body": "AIMS processes account and academic information, uploaded documents, attendance photos and location, reviews and related activity to administer internships. Access depends on each role and its assigned responsibilities; company access is limited to the relevant placement or application scope. Submit only information needed for the academic process and avoid unnecessary personal or confidential company data. Read the Privacy Policy for further information. Nothing in these terms removes rights provided by applicable Philippine law, including the Data Privacy Act of 2012."
      },
      {
        "title": "9. Record retention and privacy requests",
        "body": "Academic records, attachments, review history and security records may need to be retained for legitimate academic, administrative or legal purposes. Clearing the app cache, hiding a document, signing out or uninstalling the app does not delete those server records. Request access, correction or deletion through the university's official channels; requests remain subject to applicable privacy rights and lawful retention requirements. These terms do not establish an automatic deletion period."
      },
      {
        "title": "10. Notifications, availability and retries",
        "body": "Notification preferences and phone permissions affect delivery. Network conditions or service interruptions can delay email, push and in-app updates. Check your AIMS records and official school instructions for deadlines and decisions. After a connection failure, refresh the relevant records before retrying because the server may already have received the submission. Report missing or inconsistent records rather than repeatedly submitting the same action."
      },
      {
        "title": "11. Responsible access and shared materials",
        "body": "Use only the records and actions your role permits. Do not attempt to access another student's documents, bypass approval checks, disrupt the service or share confidential records without authorization. Respect the rights of students, the university, partner companies and creators of uploaded material. Account access may be restricted to address security incidents or misuse; contact the administrator to review an access issue. This does not itself determine an academic disciplinary outcome."
      },
      {
        "title": "12. Updates and assistance",
        "body": "The date above identifies the revision displayed in this app. Review updated terms when a new revision is made available. For questions about requirements, attendance, reviews or completion, contact your assigned coordinator. For sign-in or account-security issues, contact the school administrator. Use the university's official privacy contact for personal-data concerns. Do not send passwords or one-time codes in a support report."
      }
    ]
  },
  "privacy": {
    "title": "Privacy Policy",
    "updated": "November 19, 2026",
    "sections": [
      {
        "title": "1. Information used by AIMS",
        "body": "AIMS processes your name, student number, registered email, academic program and term, and account information. Depending on the features you use, it also processes uploaded documents, application records, journals, attendance, review decisions and completion records. Profile photos and other optional information are processed when you provide them."
      },
      {
        "title": "2. Internship administration",
        "body": "This information supports student eligibility, company applications, school endorsement, deployment, attendance reviews, journals and internship completion. Text extraction and OCR help reviewers check documents; they do not authenticate signatures or prove that a document is genuine. Only submit information relevant to your internship and information you are authorized to share."
      },
      {
        "title": "3. Attendance evidence and absence requests",
        "body": "Attendance capture uses the camera and location permissions you choose to grant. Submitted attendance may contain a newly captured photo, coordinates and capture information for company and coordinator review. Location accuracy depends on your device and available signals. AIMS does not treat a photo or coordinate alone as proof of attendance. An absence request includes the reason and supporting information you submit; avoid unnecessary medical or other sensitive details."
      },
      {
        "title": "4. Who can access records",
        "body": "Access is limited by role and assigned responsibilities. Your coordinator reviews assigned student records. Linked company supervisors can access relevant applications and placement records for their companies. The Career Center, Dean and administrator have access appropriate to their responsibilities. Do not share another person's documents or confidential company information without authorization."
      },
      {
        "title": "5. Sessions and usage information",
        "body": "AIMS uses browser or app storage for sign-in sessions and preferences. Keep me signed in is optional; sign out when using a shared device. Security and activity records support account protection and system administration. Foreground activity reports include account identity, web or mobile platform and timestamps, supporting aggregate usage statistics for administrators. Clearing browser storage or uninstalling the app does not erase server records."
      },
      {
        "title": "6. Hosting and communications",
        "body": "AIMS uses backend hosting, file storage, email and notification services to operate the system and deliver account or internship updates. Notification preferences and device permissions affect optional delivery. Keep documents, attendance photos, locations and review feedback inside AIMS when communicating about a record. Do not send passwords or one-time codes in support messages."
      },
      {
        "title": "7. Retention and corrections",
        "body": "Account, academic, application, attachment, review and security records may be retained for legitimate academic, administrative or legal purposes. Hiding or replacing a document does not necessarily erase its earlier version, application attachment or review history. Request access, correction or deletion through the university's official privacy channels. Requests are subject to applicable rights and lawful retention requirements; this policy does not promise an automatic deletion period."
      },
      {
        "title": "8. Your choices and assistance",
        "body": "You can manage available notification preferences, device permissions and active sessions. Contact your assigned coordinator about internship records and the school administrator about account access. Direct privacy questions or requests to the university's official privacy contact. Acknowledging this policy does not remove applicable privacy rights or give unrestricted permission to use your information for unrelated purposes."
      },
      {
        "title": "9. Policy updates",
        "body": "The revision date identifies the policy displayed during web sign-up. Review later policy changes when they are made available. These notices explain AIMS features and record handling; official university policies and applicable requirements continue to govern the internship process."
      }
    ]
  }
} as const
