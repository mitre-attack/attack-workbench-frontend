import { ReleaseReviewDialogComponent } from './release-review-dialog.component';

describe('ReleaseReviewDialogComponent', () => {
  const createComponent = (count = 2) => {
    const dialogRef = { close: vi.fn() } as any;
    const items = Array.from({ length: count }, (_, index) => ({
      item: {
        object_ref: `attack-pattern--${index}`,
        name: `Technique ${index}`,
      },
      current: {
        name: `Technique ${index}`,
        type: 'attack-pattern',
      },
      prior: null,
    })) as any;
    return {
      component: new ReleaseReviewDialogComponent(dialogRef, { items }),
      dialogRef,
    };
  };

  it('steps through items and returns approved objects', () => {
    const { component, dialogRef } = createComponent();

    component.approve();

    expect(component.index).toBe(1);
    expect(dialogRef.close).not.toHaveBeenCalled();

    component.skip();

    expect(dialogRef.close).toHaveBeenCalledWith({
      approved: [expect.objectContaining({ object_ref: 'attack-pattern--0' })],
      updateRequests: [],
    });
  });

  it('requires a note before requesting updates', () => {
    const { component, dialogRef } = createComponent(1);

    component.requestUpdates();
    expect(dialogRef.close).not.toHaveBeenCalled();

    component.note = 'Please update the description.';
    component.requestUpdates();

    expect(dialogRef.close).toHaveBeenCalledWith({
      approved: [],
      updateRequests: [
        {
          item: expect.objectContaining({ object_ref: 'attack-pattern--0' }),
          note: 'Please update the description.',
        },
      ],
    });
  });

  it('exposes the active object metadata and diff config', () => {
    const { component } = createComponent();

    expect(component.objectName).toBe('Technique 0');
    expect(component.progressLabel).toBe('1 of 2');
    expect(component.config).toEqual({
      mode: 'diff',
      object: [component.reviewItem.current, component.reviewItem.prior],
      editable: false,
      sidebarControl: 'disable',
      showRelationships: false,
    });

    delete (component.reviewItem.item as any).name;
    (component.reviewItem.item as any).attack_id = 'T0001';
    expect(component.objectName).toBe('T0001');

    delete (component.reviewItem.item as any).attack_id;
    expect(component.objectName).toBe('Object');
  });

  it('closes without a result when no actions have been completed', () => {
    const { component, dialogRef } = createComponent();

    component.cancel();

    expect(dialogRef.close).toHaveBeenCalledWith(undefined);
  });

  it('preserves completed actions when closing before the final item', () => {
    const { component, dialogRef } = createComponent();

    component.approve();
    component.cancel();

    expect(dialogRef.close).toHaveBeenLastCalledWith({
      approved: [expect.objectContaining({ object_ref: 'attack-pattern--0' })],
      updateRequests: [],
    });
  });
});
