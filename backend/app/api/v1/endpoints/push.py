from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.push import PushDevice, PushDelivery

router = APIRouter()
class DeviceInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    token: str = Field(max_length=255, pattern=r'^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$')

@router.put('/device')
def register_device(payload: DeviceInput, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    device = db.query(PushDevice).filter(PushDevice.token == payload.token).with_for_update().first()
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if device is None:
        device = PushDevice(user_id=user.id, token=payload.token, created_at=now)
        db.add(device)
    elif device.user_id != user.id or not device.active:
        # A shared device must never receive queued messages for its previous account.
        db.query(PushDelivery).filter(PushDelivery.device_id == device.id, PushDelivery.status.in_(['queued','ticketed'])).update({'status':'cancelled'})
        device.user_id = user.id
        device.created_at = now
    device.active = True
    db.commit()
    return {'message':'Device registered'}

@router.delete('/device')
def unregister_device(payload: DeviceInput, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    devices = db.query(PushDevice).filter(PushDevice.user_id == user.id, PushDevice.token == payload.token).all()
    for device in devices:
        device.active = False
        db.query(PushDelivery).filter(PushDelivery.device_id == device.id, PushDelivery.status.in_(['queued','ticketed'])).update({'status':'cancelled'})
    db.commit()
    return {'message':'Device unregistered'}
