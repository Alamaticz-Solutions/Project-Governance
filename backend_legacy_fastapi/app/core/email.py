import logging
from email.message import EmailMessage
import aiosmtplib
from app.core.config import settings

logger = logging.getLogger(__name__)

async def send_intake_copy_email(to_email: str, data: dict, project_id: str):
    """Sends a formatted HTML email copy of the intake responses."""
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: 'Inter', sans-serif; background-color: #F4F5F7; margin: 0; padding: 0; }}
        .email-wrapper {{ max-width: 600px; margin: 40px auto; background: #FFFFFF; border-radius: 12px; border: 1px solid #DFE1E6; overflow: hidden; }}
        .email-header {{ background-color: #0052CC; color: #FFFFFF; padding: 30px; text-align: center; }}
        .email-body {{ padding: 30px; color: #172B4D; }}
        .data-grid {{ width: 100%; border-collapse: collapse; margin-bottom: 25px; }}
        .data-grid th {{ text-align: left; font-size: 11px; text-transform: uppercase; color: #6B778C; padding: 12px 10px 4px 0; border-bottom: 1px solid #EBECF0; width: 35%; }}
        .data-grid td {{ padding: 12px 0 4px 0; font-size: 14px; font-weight: 600; color: #172B4D; border-bottom: 1px solid #EBECF0; }}
        .text-block {{ background: #FAFBFC; border: 1px solid #DFE1E6; border-radius: 6px; padding: 16px; margin-bottom: 20px; }}
        .text-block-title {{ font-size: 11px; font-weight: 700; color: #6B778C; text-transform: uppercase; margin-bottom: 8px; }}
        .text-block-content {{ font-size: 14px; line-height: 1.6; color: #172B4D; margin: 0; }}
      </style>
    </head>
    <body>
      <div class="email-wrapper">
        <div class="email-header">
          <h1 style="margin: 0;">Project Governance Portal</h1>
          <p>Your Project Intake Proposal has been received</p>
        </div>
        <div class="email-body">
          <p>Hello,</p>
          <p>Thank you for submitting your project proposal. Below is a copy of your responses.</p>
          
          <h2 style="font-size: 18px; border-bottom: 2px solid #F4F5F7; padding-bottom: 10px;">Proposal Summary (ID: {project_id})</h2>
          <table class="data-grid">
            <tr><th>Project Name</th><td>{data.get('projectName', 'N/A')}</td></tr>
            <tr><th>Requestor</th><td>{data.get('requestorName', 'N/A')}</td></tr>
            <tr><th>Department</th><td>{data.get('requestingDepartment', 'N/A')}</td></tr>
            <tr><th>Request Type</th><td>{data.get('requestType', 'N/A')}</td></tr>
          </table>

          <div class="text-block">
            <div class="text-block-title">Problem / Opportunity Statement</div>
            <p class="text-block-content">{data.get('problemStatement', 'N/A')}</p>
          </div>

          <div class="text-block">
            <div class="text-block-title">Desired Outcome</div>
            <p class="text-block-content">{data.get('desiredOutcome', 'N/A')}</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="http://localhost:4200/" style="display: inline-block; background-color: #0052CC; color: #FFFFFF; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600;">View in Portal</a>
          </div>
        </div>
      </div>
    </body>
    </html>
    """

    message = EmailMessage()
    message["From"] = f"{settings.EMAIL_FROM_NAME} <{settings.EMAIL_FROM}>"
    message["To"] = to_email
    message["Subject"] = f"Confirmation: Intake Proposal Received ({project_id})"
    message.set_content("Please view this email in an HTML-compatible client.")
    message.add_alternative(html_content, subtype="html")

    try:
        # If no credentials, log the attempt but skip actual SMTP connection to avoid crashing in dev
        if not settings.SMTP_USER:
            logger.info(f"Mock Email sent to {to_email} for project {project_id} (No SMTP configured).")
            return {"status": "mock", "message": "Email logged (No SMTP config)"}
            
        await aiosmtplib.send(
            message,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
            use_tls=True if settings.SMTP_PORT == 465 else False,
            start_tls=True if settings.SMTP_PORT == 587 else False,
        )
        logger.info(f"Email successfully sent to {to_email} for project {project_id}.")
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {str(e)}")
        raise e
