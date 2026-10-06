# CertiChain V91 – Certificate Email Workflow

## New certificate workflow
1. In **Issue Certificate**, enter the participant email address (or use the CSV `email` column for bulk issuance).
2. Click **Issue single certificate** or **Issue & email bulk certificates**.
3. The immutable certificate is saved first.
4. CertiChain then automatically sends the certificate through the Gmail API.
5. The certificate keeps an email status (`Preparing…`, `Sending…`, `Sent`, or `Failed`) in the issued record.
6. Existing/old certificates are not touched and are not emailed as a side effect of the deployment.

## Old certificate workflow
1. Open **Issued Certificates**.
2. Select one or more previously issued certificates using the checkboxes.
3. Click **Email selected**.
4. The **Email Selected Certificates** page shows only the chosen certificates.
5. Edit the subject/body if required and click **Send selected certificates**.
6. Each selected certificate is sent to the email stored with that immutable record.

## Important behavior
- Issuance and delivery are separate operations so a Gmail outage never deletes or rolls back an issued certificate.
- Failed automatic deliveries remain visible in **Issued Certificates** and can be selected later for email retry.
- The certificate content, template snapshot, certificate ID, and issued timestamp remain immutable after issuance.
