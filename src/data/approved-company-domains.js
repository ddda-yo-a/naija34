import { companyDomains } from './company-directory.js';

// The map makes both domain approval and canonical company lookup constant-time.
const companiesByDomain = new Map(
  companyDomains.map((company) => [company.domain.toLowerCase(), Object.freeze({ ...company })])
);

export const approvedCompanyDomains = new Set(companiesByDomain.keys());

export function getEmailDomain(email) {
  return email.slice(email.lastIndexOf('@') + 1).toLowerCase();
}

export function getApprovedCompanyForEmail(email) {
  return companiesByDomain.get(getEmailDomain(email)) ?? null;
}

export function isApprovedCompanyEmail(email) {
  return Boolean(getApprovedCompanyForEmail(email));
}

