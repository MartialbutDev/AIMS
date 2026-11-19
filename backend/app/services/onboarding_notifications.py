"""Fixed onboarding copy shared by inbox messages and privacy-safe push previews."""


def onboarding_message(document_kind, status):
    labels = {'orientation': 'Orientation certificate', 'cor': 'COR'}
    label = labels.get(document_kind, 'Onboarding') if isinstance(document_kind, str) else 'Onboarding'
    if label == 'Onboarding':
        if status in {'rejected', 'returned', 'needs_revision'}:
            return 'Onboarding needs attention', 'Check your orientation and COR feedback in AIMS.'
        return 'Onboarding review update', 'Check your orientation and COR status in AIMS.'
    subject = 'COR' if document_kind == 'cor' else 'orientation certificate'
    if status == 'verified':
        return f'{label} verified', f'The {subject} has been verified. Open AIMS to view the onboarding status.'
    if status in {'pending', 'pending_review', 'needs_review'}:
        return f'{label} awaiting review', f'The {subject} is awaiting review. Open AIMS to check the status.'
    if status in {'rejected', 'returned', 'needs_revision'}:
        return f'{label} needs attention', f'Open AIMS to read the {subject} review feedback.'
    return f'{label} review update', 'Open AIMS to check the onboarding status.'
