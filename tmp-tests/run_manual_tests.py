from apps.api.tests import test_announcements_scoping as a, test_resident_id_privacy as b

print("Running announcement tests...")
a.test_verified_resident_scoping()
a.test_guest_only_sees_province_announcements()

print("Running resident ID privacy tests...")
b.test_id_view_permission_required()
b.test_audit_logging_on_id_view()
b.test_path_traversal_protection()
b.test_municipality_scope_enforcement()
b.test_superadmin_cross_municipality_access()
b.test_document_type_validation()

print("ALL TEST FUNCTIONS COMPLETED")
