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
});
