import React, { type CSSProperties } from "react";
import type { WelcomeTemplate } from "@shared/welcomeSchedule";
import OwnerModal from "./OwnerModal";
import "./WelcomeMessage.css";

export default function WelcomeDialog({ template, open, onClose, preview = false }: { template: WelcomeTemplate; open: boolean; onClose: () => void; preview?: boolean }) {
  const style = { "--welcome-bg": template.backgroundColor, "--welcome-fg": template.textColor, "--welcome-accent": template.accentColor } as CSSProperties;
  return <OwnerModal open={open} onClose={onClose} title={template.title} ariaLabel="الرسالة الترحيبية" className="welcome-message" style={style}>
    {template.image && <img className="welcome-message-image" src={template.image} alt={template.title} />}
    {template.intro && <p className="welcome-message-intro">{template.intro}</p>}
    <p className="welcome-message-body">{template.body}</p>
    {template.buttonUrl && !preview ? <a className="welcome-message-continue" href={template.buttonUrl} onClick={onClose}>{template.buttonLabel}</a> : <button type="button" className="welcome-message-continue" onClick={onClose}>{template.buttonLabel}</button>}
    {preview && <small className="welcome-preview-label">معاينة خاصة — زر الرابط لا ينقلك، ولا يستهلك جلسة الزائر.</small>}
  </OwnerModal>;
}
