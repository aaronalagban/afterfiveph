// src/app/admin/submit/page.jsx
import ManualSubmissionForm from '../../components/ManualSubmissionForm';

export const metadata = {
  title: 'AfterFive Admin | Submit Event',
  description: 'Manual event submission for AfterFive.',
};

export default function AdminSubmissionPage() {
  return (
    <ManualSubmissionForm />
  );
}